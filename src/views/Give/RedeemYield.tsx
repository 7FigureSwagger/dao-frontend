import { t, Trans } from "@lingui/macro";
import { Grid, Typography } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { Skeleton } from "@material-ui/lab";
import { DataRow, PrimaryButton } from "@olympusdao/component-library";
import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { GiveBox as Box } from "src/components/GiveProject/GiveBox";
import { NetworkId } from "src/constants";
import { DecimalBigNumber } from "src/helpers/DecimalBigNumber/DecimalBigNumber";
import { Environment } from "src/helpers/environment/Environment/Environment";
import { useRecipientInfo, useRedeemableBalance, useTotalDonated } from "src/hooks/useGiveInfo";
import { useStakingRebaseRate } from "src/hooks/useStakingRebaseRate";
import { useWeb3Context } from "src/hooks/web3Context";
import { isPendingTxn, txnButtonText } from "src/slices/PendingTxnsSlice";

import { Project } from "../../components/GiveProject/project.type";
import { redeemBalance, redeemMockBalance } from "../../slices/RedeemThunk";
import { DonationInfoState } from "./Interfaces";
import data from "./projects.json";
import { RedeemCancelCallback, RedeemYieldModal } from "./RedeemYieldModal";

// Consistent with staking page
const DECIMAL_PLACES = 4;
const ZERO_NUMBER = new DecimalBigNumber("0");
const DECIMAL_FORMAT = { decimals: DECIMAL_PLACES, format: true };
const NO_DECIMAL_FORMAT = { format: true };

export default function RedeemYield() {
  const location = useLocation();
  const dispatch = useDispatch();
  const { provider, address, networkId } = useWeb3Context();
  const [isRedeemYieldModalOpen, setIsRedeemYieldModalOpen] = useState(false);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { projects } = data;
  const projectMap = new Map(projects.map(i => [i.wallet, i] as [string, Project]));

  const _useRedeemableBalance = useRedeemableBalance(address);
  const redeemableBalance: DecimalBigNumber = useMemo(() => {
    if (_useRedeemableBalance.isLoading || _useRedeemableBalance.data === undefined) return new DecimalBigNumber("0");

    return new DecimalBigNumber(_useRedeemableBalance.data);
  }, [_useRedeemableBalance]);

  const _useRecipientInfo = useRecipientInfo(address);
  const isRecipientInfoLoading = _useRecipientInfo.isLoading;

  const _useTotalDonated = useTotalDonated(projectMap.get(address) ? address : "");
  /**
   * Get the amount of sOHM yield donated by the current user and return as a number
   */
  const totalDonated: DecimalBigNumber = useMemo(() => {
    if (_useTotalDonated.isLoading || _useTotalDonated.data === undefined) return new DecimalBigNumber("0");

    return new DecimalBigNumber(_useTotalDonated.data);
  }, [_useTotalDonated]);

  const _useStakingRebaseRate = useStakingRebaseRate();
  const isStakingRebaseRateLoading = _useStakingRebaseRate.isLoading;
  const stakingRebase: DecimalBigNumber = useMemo(() => {
    if (_useStakingRebaseRate.isLoading || _useStakingRebaseRate.data === undefined) return new DecimalBigNumber("0");

    return new DecimalBigNumber(_useStakingRebaseRate.data.toString());
  }, [_useStakingRebaseRate]);

  const fiveDayRate: DecimalBigNumber = useMemo(() => {
    if (stakingRebase.eq(ZERO_NUMBER)) return ZERO_NUMBER;

    return new DecimalBigNumber((Math.pow(1 + stakingRebase.toApproxNumber(), 5 * 3) - 1).toString());
  }, [stakingRebase]);

  const pendingTransactions = useSelector((state: DonationInfoState) => {
    return state.pendingTransactions;
  });

  const totalDeposit: DecimalBigNumber = useMemo(() => {
    if (_useRecipientInfo.isLoading || _useRecipientInfo.data == undefined) return new DecimalBigNumber("0");

    return new DecimalBigNumber(_useRecipientInfo.data.totalDebt);
  }, [_useRecipientInfo]);

  const stakingRebasePercentage = stakingRebase.mul(new DecimalBigNumber("100"));

  const nextRewardValue = stakingRebase.mul(totalDeposit);

  const fiveDayRateValue = fiveDayRate.mul(new DecimalBigNumber("100"));

  const isProject = projectMap.get(address);

  /**
   * Get project sOHM yield goal and return as a DecimalBigNumber
   *
   * @param address
   * @returns
   */
  const getRecipientGoal = (address: string): DecimalBigNumber => {
    const project = projectMap.get(address);
    if (project) return new DecimalBigNumber(project.depositGoal.toString());

    return ZERO_NUMBER;
  };

  /**
   * Checks that the current user can redeem some quantity of sOHM
   *
   * @returns
   */
  const canRedeem = () => {
    if (!address) return false;

    if (isRecipientInfoLoading) return false;

    // TODO shift to react-query
    if (isPendingTxn(pendingTransactions, "redeeming")) return false;

    if (redeemableBalance.eq(ZERO_NUMBER))
      // If the available amount is 0
      return false;

    return true;
  };

  const handleRedeemButtonClick = () => {
    setIsRedeemYieldModalOpen(true);
  };

  const handleRedeemYieldModalSubmit = async () => {
    if (networkId === NetworkId.TESTNET_RINKEBY && Environment.isMockSohmEnabled(location.search)) {
      await dispatch(redeemMockBalance({ address, provider, networkID: networkId, eventSource: "Redeem" }));
    } else {
      await dispatch(redeemBalance({ address, provider, networkID: networkId, eventSource: "Redeem" }));
    }
    setIsRedeemYieldModalOpen(false);
  };

  const handleRedeemYieldModalCancel: RedeemCancelCallback = () => {
    setIsRedeemYieldModalOpen(false);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h3" align="center" data-testid="redeemable-balance">
          {isRecipientInfoLoading ? <Skeleton /> : redeemableBalance.toString(DECIMAL_FORMAT)} sOHM
        </Typography>
        <Typography variant="body1" align="center" className="subtext">
          Redeemable Yield
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Grid container>
          <Grid item xs />
          <Grid item xs={12} sm={6}>
            <PrimaryButton onClick={() => handleRedeemButtonClick()} disabled={!canRedeem()} fullWidth>
              {
                /* TODO migrate uses of pendingTransactions */
                txnButtonText(pendingTransactions, "redeeming", t`Redeem Yield`)
              }
            </PrimaryButton>
          </Grid>
          <Grid item xs />
        </Grid>
      </Grid>
      {isProject ? (
        <Grid item xs={12}>
          <Grid container spacing={1}>
            <Grid item xs={4}>
              <Box>
                <Typography variant="h5" align="center" data-testid="project-goal">
                  {getRecipientGoal(address).toString(DECIMAL_FORMAT)}
                </Typography>
                <Typography variant="body1" align="center" className="subtext">
                  <Trans>sOHM Goal</Trans>
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box>
                <Typography variant="h5" align="center" data-testid="project-deposit">
                  {totalDonated.toString(DECIMAL_FORMAT)}
                </Typography>
                <Typography variant="body1" align="center" className="subtext">
                  {isSmallScreen ? t`Total Donated` : t`Total sOHM Donated`}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box>
                <Typography variant="h5" align="center" data-testid="project-goal-achievement">
                  {totalDonated
                    .mul(new DecimalBigNumber("100"))
                    .div(getRecipientGoal(address))
                    .toString(DECIMAL_FORMAT)}
                  %
                </Typography>
                <Typography variant="body1" align="center" className="subtext">
                  <Trans>of sOHM Goal</Trans>
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Grid>
      ) : (
        <></>
      )}
      <Grid item xs={12}>
        <Box>
          <DataRow
            title={t`Deposited sOHM`}
            // Exact number
            balance={`${totalDeposit.toString(NO_DECIMAL_FORMAT)} ${t`sOHM`}`}
            isLoading={isRecipientInfoLoading}
            data-testid="data-deposited-sohm"
          />
          <DataRow
            title={t`Redeemable Amount`}
            // Exact number
            balance={`${redeemableBalance.toString(NO_DECIMAL_FORMAT)} ${t`sOHM`}`}
            isLoading={isRecipientInfoLoading}
            data-testid="data-redeemable-balance"
          />
          <DataRow
            title={t`Next Reward Amount`}
            balance={`${nextRewardValue.toString(DECIMAL_FORMAT)} ${t`sOHM`}`}
            isLoading={isStakingRebaseRateLoading}
            data-testid="data-next-reward-amount"
          />
          <DataRow
            title={t`Next Reward Yield`}
            balance={`${stakingRebasePercentage.toString(DECIMAL_FORMAT)}%`}
            isLoading={isStakingRebaseRateLoading}
            data-testid="data-next-reward-yield"
          />
          <DataRow
            title={t`ROI (5-Day Rate)`}
            balance={`${fiveDayRateValue.toString(DECIMAL_FORMAT)}%`}
            isLoading={isStakingRebaseRateLoading}
            data-testid="data-roi"
          />
        </Box>
      </Grid>
      <Grid item>
        <RedeemYieldModal
          isModalOpen={isRedeemYieldModalOpen}
          callbackFunc={handleRedeemYieldModalSubmit}
          cancelFunc={handleRedeemYieldModalCancel}
          deposit={totalDeposit}
          redeemableBalance={redeemableBalance}
        />
      </Grid>
    </Grid>
  );
}
