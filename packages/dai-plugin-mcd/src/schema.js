import { createCurrency, createCurrencyRatio } from '@makerdao/currency';
import { toHex, fromWei, fromRay, fromRad } from './utils';
import BigNumber from 'bignumber.js';
import { USD, ETH, BAT, MDAI } from '..';

export const PROXY_ADDRESS = 'proxyAddress';

export const proxies = {
  generate: address => ({
    id: `PROXY_REGISTRY.proxies(${address})`,
    contractName: 'PROXY_REGISTRY',
    call: ['proxies(address)(address)', address]
  }),
  returns: [[PROXY_ADDRESS]]
};

export const TOTAL_ENCUMBERED_DEBT = 'totalEncumberedDebt';
export const DEBT_SCALING_FACTOR = 'debtScalingFactor';
export const PRICE_WITH_SAFETY_MARGIN = 'priceWithSafetyMargin';
export const DEBT_CEILING = 'debtCeiling';
export const URN_DEBT_FLOOR = 'urnDebtFloor';

export const vatIlks = {
  generate: ilkName => ({
    id: `MCD_VAT.ilks(${ilkName})`,
    contractName: 'MCD_VAT',
    call: [
      'ilks(bytes32)(uint256,uint256,uint256,uint256,uint256)',
      toHex(ilkName)
    ]
  }),
  returns: [
    [TOTAL_ENCUMBERED_DEBT, BigNumber],
    [DEBT_SCALING_FACTOR, fromRay],
    [PRICE_WITH_SAFETY_MARGIN, fromRay],
    [DEBT_CEILING, fromRad],
    [URN_DEBT_FLOOR, fromRad]
  ]
};

export const TOTAL_DAI_SUPPLY = 'totalDaiSupply';
export const debt = {
  generate: () => ({
    id: `VAT.debt()`,
    contractName: 'MCD_VAT',
    call: ['debt()(uint256)']
  }),
  returns: [[TOTAL_DAI_SUPPLY, MDAI.rad]]
};

export const PRICE_FEED_ADDRESS = 'priceFeedAddress';
export const RAW_LIQUIDATION_RATIO = 'rawLiquidationRatio';

export const spotIlks = {
  generate: ilkName => ({
    id: `MCD_SPOT.ilks(${ilkName})`,
    contractName: 'MCD_SPOT',
    call: ['ilks(bytes32)(address,uint256)', toHex(ilkName)]
  }),
  returns: [PRICE_FEED_ADDRESS, [RAW_LIQUIDATION_RATIO, fromRay]]
};

export const LIQUIDATION_RATIO = 'liquidationRatio';
export const liquidationRatio = {
  // The liquidation ratio value is the minimum dollar amount of collateral in
  // terms of a single dollar unit amount of debt
  //
  // In plain english, it is the ratio of the dollar amount of ETH in terms of
  // the dollar amount of dai
  generate: ilkName => ({
    dependencies: () => [[RAW_LIQUIDATION_RATIO, ilkName]],
    computed: liqRatio =>
      createCurrencyRatio(
        createCurrency(`(${ilkName.split('-')[0]}/USD)`),
        createCurrency(`(${MDAI.symbol}/USD)`)
      )(liqRatio)
  })
};

export const RATIO_DAI_USD = 'ratioDaiUsd';
export const spotPar = {
  generate: () => ({
    id: 'MCD_SPOT.par()',
    contractName: 'MCD_SPOT',
    call: ['par()(uint256)']
  }),
  returns: [[RATIO_DAI_USD, v => createCurrencyRatio(MDAI, USD)(fromRay(v))]]
};

export const ILK_PRICES = 'ilkPrices';
export const ilkPrices = {
  generate: ilkNames => ({
    // Dynamically generated dependencies
    dependencies: () => [
      [RATIO_DAI_USD],
      ...ilkNames.reduce(
        (acc, ilk) => [
          ...acc,
          [PRICE_WITH_SAFETY_MARGIN, ilk],
          [LIQUIDATION_RATIO, ilk]
        ],
        []
      )
    ],
    computed: (ratioDaiUsd, ...results) =>
      results.reduce((acc, r, i) => {
        if (i % 2 === 0) {
          const priceWithSafetyMargin = results[i];
          const liquidationRatio = results[i + 1];
          const currency = createCurrency(
            liquidationRatio.numerator.symbol.substring(1, 4)
          );
          const ratio = createCurrencyRatio(USD, currency);
          const price = priceWithSafetyMargin
            .times(ratioDaiUsd.toNumber())
            .times(liquidationRatio.toNumber());
          return [...acc, ratio(price)];
        }
        return acc;
      }, [])
  })
};

export default {
  vatIlks,
  proxies,
  debt,
  spotIlks,
  spotPar,
  ilkPrices,
  liquidationRatio
};