import { t } from "@lingui/macro";
import { useTheme } from "@mui/material/styles";
import { CSSProperties } from "react";
import Chart from "src/components/Chart/Chart";
import { getSubgraphUrl } from "src/constants";
import {
  ProtocolOwnedLiquidityComponentsQuery,
  useKeyMetricsQuery,
  useMarketValueMetricsQuery,
  useProtocolOwnedLiquidityComponentsQuery,
} from "src/generated/graphql";
import { formatCurrency } from "src/helpers";

import { itemType, tooltipInfoMessages, tooltipItems } from "../../treasuryData";

// These constants are used by charts to have consistent colours
const defaultColors: string[] = ["#FFBF00", "#FF7F50", "#DE3163", "#9FE2BF", "#40E0D0", "#6495ED", "#CCCCFF"];
const defaultStopColours: string[][] = defaultColors.map(value => [value, value]);
const defaultBulletpointColours: CSSProperties[] = defaultColors.map(value => {
  return {
    background: value,
  };
});

/**
 * React Component that displays a line graph comparing the
 * OHM price and liquid backing per floating OHM.
 *
 * @returns
 */
export const LiquidBackingPerOhmComparisonGraph = () => {
  const theme = useTheme();
  const { data } = useKeyMetricsQuery({ endpoint: getSubgraphUrl() });

  const itemNames = [t`OHM Price`, t`Liquid Backing per Floating OHM`];

  return (
    <Chart
      type="multi"
      data={data ? data.protocolMetrics : []}
      dataKey={["ohmPrice", "treasuryLiquidBackingPerOhmFloating"]}
      itemType={itemType.dollar}
      color={theme.palette.text.primary}
      stopColor={defaultStopColours}
      stroke={defaultColors}
      headerText={t`OHM Backing`}
      headerSubText={`${data && formatCurrency(data.protocolMetrics[0].treasuryLiquidBackingPerOhmFloating, 2)}`}
      dataFormat=""
      bulletpointColors={defaultBulletpointColours}
      itemNames={itemNames}
      margin={{ left: 30 }}
      infoTooltipMessage={tooltipInfoMessages().backingPerOhm}
      expandedGraphStrokeColor={theme.palette.primary.contrastText}
      isPOL={false}
      isStaked={false}
      itemDecimals={2}
    />
  );
};

export const MarketValueGraph = () => {
  const theme = useTheme();
  const { data } = useMarketValueMetricsQuery({ endpoint: getSubgraphUrl() });

  return (
    <Chart
      type="stack"
      data={data ? data.protocolMetrics : []}
      dataKey={["treasuryStableValue", "treasuryVolatileValue", "treasuryLPValue"]}
      color={theme.palette.text.primary}
      stopColor={defaultStopColours}
      stroke={defaultColors}
      dataFormat=""
      headerText={t`Market Value of Treasury Assets`}
      headerSubText={`${data && formatCurrency(data.protocolMetrics[0].treasuryMarketValue)}`}
      bulletpointColors={defaultBulletpointColours}
      itemNames={tooltipItems.marketValueComponents}
      itemType={itemType.dollar}
      infoTooltipMessage={tooltipInfoMessages().mvt}
      expandedGraphStrokeColor={theme.palette.primary.contrastText}
      isPOL={false}
      isStaked={false}
      itemDecimals={0}
    />
  );
};

const getUniqueTokens = (metrics: ProtocolOwnedLiquidityComponentsQuery | undefined): string[] => {
  const tokenNames = new Set<string>();

  if (metrics) {
    metrics.protocolMetrics.forEach(metric => {
      metric.treasuryLPValueComponents.records.forEach(record => {
        if (!tokenNames.has(record.token)) tokenNames.add(record.token);
      });
    });
  }

  return Array.from(tokenNames);
};

type TokenValues = {
  [token: string]: number;
};

type FlatProtocolOwnedLiquidity = {
  timestamp: string;
  tokens: TokenValues;
};

/**
 * Flattens the component values in `treasuryLPValueComponents`.
 *
 * The data structure is as follows:
 * ```
 * metrics.protocolMetrics {
 *  timestamp
 *  treasuryLPValueComponents {
 *    records {
 *      token
 *      value
 *    }
 *  }
 * }
 * ```
 *
 * This is difficult for the charting library to handle, so the values are
 * summed and grouped under each token, as defined in {FlatProtocolOwnedLiquidity}.
 *
 * @param metrics The query result
 * @returns array of FlatProtocolOwnedLiquidity elements
 */
const getFlattenedData = (metrics: ProtocolOwnedLiquidityComponentsQuery | undefined): FlatProtocolOwnedLiquidity[] => {
  const flattenedData: FlatProtocolOwnedLiquidity[] = [];
  if (!metrics) return flattenedData;

  metrics.protocolMetrics.forEach(metric => {
    const tokenValues: TokenValues = {};

    metric.treasuryLPValueComponents.records.forEach(record => {
      const currentValue: number = tokenValues[record.token];
      const recordValue: number = typeof record.value === "number" ? record.value : parseFloat(record.value);
      const newValue: number = currentValue ? currentValue + recordValue : recordValue;

      tokenValues[record.token] = newValue;
    });

    const flatData: FlatProtocolOwnedLiquidity = {
      timestamp: metric.timestamp,
      tokens: tokenValues,
    };
    flattenedData.push(flatData);
  });

  return flattenedData;
};

export const ProtocolOwnedLiquidityGraph = () => {
  const theme = useTheme();
  const { data } = useProtocolOwnedLiquidityComponentsQuery({ endpoint: getSubgraphUrl() });

  // Extract out unique categories
  const tokenCategories = getUniqueTokens(data);
  // Data keys require a prefix
  const tokenDataKeys = tokenCategories.map(value => "tokens." + value);

  // Flatten the token values
  const flatData = getFlattenedData(data);

  return (
    <Chart
      type="stack"
      data={flatData}
      dataKey={tokenDataKeys}
      color={theme.palette.text.primary}
      stopColor={defaultStopColours}
      stroke={defaultColors}
      dataFormat=""
      headerText={t`Protocol-Owned Liquidity`}
      headerSubText={`${data && formatCurrency(data.protocolMetrics[0].treasuryLPValueComponents.value, 0)}`}
      bulletpointColors={defaultBulletpointColours}
      itemNames={tokenCategories}
      itemType={itemType.dollar}
      infoTooltipMessage={tooltipInfoMessages().mvt}
      expandedGraphStrokeColor={theme.palette.primary.contrastText}
      isPOL={false}
      isStaked={false}
      itemDecimals={0}
    />
  );
};
