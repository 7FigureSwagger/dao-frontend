import { useState } from "react";
import { useDispatch } from "react-redux";
import { Box, Button, Typography, TableRow, TableCell, Divider } from "@material-ui/core";
import { BigNumber } from "bignumber.js";
import { shorten } from "src/helpers";
import data from "./projects.json";
import { Project } from "../../components/GiveProject/project.type";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { ManageDonationModal } from "./ManageDonationModal";
import { RecipientModal } from "src/views/Give/RecipientModal";
import { WithdrawDepositModal, WithdrawSubmitCallback, WithdrawCancelCallback } from "./WithdrawDepositModal";
import { SubmitCallback } from "src/views/Give/Interfaces";
import { error } from "../../slices/MessagesSlice";
import { t, Trans } from "@lingui/macro";
import { useWeb3Context } from "src/hooks/web3Context";
import { NetworkId } from "src/constants";
import { EnvHelper } from "src/helpers/Environment";
import { ACTION_GIVE_EDIT, ACTION_GIVE_WITHDRAW, changeGive, changeMockGive } from "../../slices/GiveThunk";
import "./give.scss";

interface IUserDonationInfo {
  date: string;
  deposit: string;
  recipient: string;
  yieldDonated: string;
}

interface DepositRowProps {
  depositObject: IUserDonationInfo;
}

export const DepositTableRow = ({ depositObject }: DepositRowProps) => {
  const dispatch = useDispatch();
  const { provider, address, networkId } = useWeb3Context();
  const { projects } = data;
  const projectMap = new Map(projects.map(i => [i.wallet, i] as [string, Project]));
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const isSmallScreen = useMediaQuery("(max-width: 600px)");

  const getRecipientTitle = (address: string): string => {
    const project = projectMap.get(address);
    if (!project) return shorten(address);

    if (!project.owner) return project.title;

    return project.owner + " - " + project.title;
  };

  const handleManageModalCancel = () => {
    setIsManageModalOpen(false);
  };

  const switchToEditModal = () => {
    setIsManageModalOpen(false);
    setIsEditModalOpen(true);
  };

  const switchToWithdrawModal = () => {
    setIsManageModalOpen(false);
    setIsWithdrawModalOpen(true);
  };

  const handleEditModalSubmit: SubmitCallback = async (walletAddress, depositAmount, depositAmountDiff) => {
    if (!depositAmountDiff) {
      return dispatch(error(t`Please enter a value!`));
    }

    if (depositAmountDiff.isEqualTo(new BigNumber(0))) return;

    // If reducing the amount of deposit, withdraw
    if (networkId === NetworkId.TESTNET_RINKEBY && EnvHelper.isMockSohmEnabled(location.search)) {
      await dispatch(
        changeMockGive({
          action: ACTION_GIVE_EDIT,
          value: depositAmountDiff.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
        }),
      );
    } else {
      await dispatch(
        changeGive({
          action: ACTION_GIVE_EDIT,
          value: depositAmountDiff.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
        }),
      );
    }

    setIsEditModalOpen(false);
  };

  const handleEditModalCancel = () => {
    setIsEditModalOpen(false);
  };

  const handleWithdrawModalSubmit: WithdrawSubmitCallback = async (walletAddress, depositAmount) => {
    // Issue withdrawal from smart contract
    if (networkId === NetworkId.TESTNET_RINKEBY && EnvHelper.isMockSohmEnabled(location.search)) {
      await dispatch(
        changeMockGive({
          action: ACTION_GIVE_WITHDRAW,
          value: depositAmount.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
        }),
      );
    } else {
      await dispatch(
        changeGive({
          action: ACTION_GIVE_WITHDRAW,
          value: depositAmount.toFixed(),
          recipient: walletAddress,
          provider,
          address,
          networkID: networkId,
          version2: false,
          rebase: false,
        }),
      );
    }

    setIsWithdrawModalOpen(false);
  };

  const handleWithdrawModalCancel: WithdrawCancelCallback = () => {
    setIsWithdrawModalOpen(false);
  };

  return (
    <Box>
      <TableRow>
        {!isSmallScreen && (
          <TableCell align="left" className="deposit-date-cell">
            <Typography variant="body1">{depositObject.date}</Typography>
          </TableCell>
        )}
        <TableCell align="left" className="deposit-recipient-cell">
          <Typography variant="body1">{getRecipientTitle(depositObject.recipient)}</Typography>
        </TableCell>
        {!isSmallScreen && (
          <TableCell align="left" className="deposit-deposited-cell">
            <Typography variant="body1">{parseFloat(depositObject.deposit).toFixed(2)}</Typography>
          </TableCell>
        )}
        <TableCell align="left" className="deposit-yield-cell">
          <Typography variant="body1">{parseFloat(depositObject.yieldDonated).toFixed(2)}</Typography>
        </TableCell>
        <TableCell align="left" className="deposit-manage-cell">
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setIsManageModalOpen(true)}
            style={{ width: "100%" }}
          >
            <Typography variant="h6">Manage</Typography>
          </Button>
        </TableCell>
      </TableRow>
      <Divider />

      <ManageDonationModal
        isModalOpen={isManageModalOpen}
        cancelFunc={handleManageModalCancel}
        switchToEdit={switchToEditModal}
        switchToWithdraw={switchToWithdrawModal}
        currentWalletAddress={depositObject.recipient}
        currentDepositAmount={new BigNumber(depositObject.deposit)}
        depositDate={depositObject.date}
        yieldSent={depositObject.yieldDonated}
        project={projectMap.get(depositObject.recipient)}
        key={"manage-modal-" + depositObject.recipient}
      />

      <RecipientModal
        isModalOpen={isEditModalOpen}
        callbackFunc={handleEditModalSubmit}
        cancelFunc={handleEditModalCancel}
        currentWalletAddress={depositObject.recipient}
        currentDepositAmount={new BigNumber(depositObject.deposit)}
        project={projectMap.get(depositObject.recipient)}
        key={"edit-modal-" + depositObject.recipient}
      />

      <WithdrawDepositModal
        isModalOpen={isWithdrawModalOpen}
        callbackFunc={handleWithdrawModalSubmit}
        cancelFunc={handleWithdrawModalCancel}
        walletAddress={depositObject.recipient}
        depositAmount={new BigNumber(depositObject.deposit)}
        project={projectMap.get(depositObject.recipient)}
        key={"withdraw-modal-" + depositObject.recipient}
      />
    </Box>
  );
};
