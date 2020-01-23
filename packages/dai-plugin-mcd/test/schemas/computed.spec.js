import { mcdMaker, setupCollateral } from '../helpers';
import { ETH, BAT, MDAI, USD } from '../../src';
import { takeSnapshot, restoreSnapshot } from '@makerdao/test-helpers';
import { fromWei } from '../../src/utils';
import { ServiceRoles } from '../../src/constants';

import {
  COLLATERAL_TYPE_PRICE,
  COLLATERAL_TYPES_PRICES,
  VAULT_TYPE_AND_ADDRESS,
  VAULT,
  SAVINGS_DAI,
  DEBT_VALUE,
  COLLATERAL_VALUE,
  DAI_AVAILABLE
} from '../../src/schemas';

import { vatIlks, vatUrns } from '../../src/schemas/vat';
import { cdpManagerUrns, cdpManagerIlks } from '../../src/schemas/cdpManager';
import { spotIlks, liquidationRatio, spotPar } from '../../src/schemas/spot';
import { proxyRegistryProxies } from '../../src/schemas/proxyRegistry';
import { potpie } from '../../src/schemas/pot';
import computedSchemas from '../../src/schemas/computed';
import { createCurrencyRatio } from '@makerdao/currency';

let maker, address, snapshotData;

const ETH_A_COLLATERAL_AMOUNT = ETH(1);
const ETH_A_DEBT_AMOUNT = MDAI(1);
const ETH_A_PRICE = 180;

const BAT_A_COLLATERAL_AMOUNT = BAT(1);
const BAT_A_DEBT_AMOUNT = MDAI(1);
const BAT_A_PRICE = 40;

beforeAll(async () => {
  snapshotData = await takeSnapshot(maker);
  maker = await mcdMaker({
    cdpTypes: [
      { currency: ETH, ilk: 'ETH-A' },
      { currency: BAT, ilk: 'BAT-A' }
    ],
    multicall: true
  });

  maker.service('multicall').createWatcher({ interval: 'block' });
  maker.service('multicall').registerSchemas({
    vatIlks,
    vatUrns,
    cdpManagerUrns,
    cdpManagerIlks,
    spotPar,
    spotIlks,
    proxyRegistryProxies,
    potpie,
    liquidationRatio,
    ...computedSchemas
  });
  maker.service('multicall').start();

  address = maker.service('web3').currentAddress();
  await setupCollateral(maker, 'ETH-A', {
    price: ETH_A_PRICE
  });
  await setupCollateral(maker, 'BAT-A', { price: BAT_A_PRICE });

  const mgr = await maker.service(ServiceRoles.CDP_MANAGER);
  const sav = await maker.service(ServiceRoles.SAVINGS);
  const dai = maker.getToken(MDAI);
  const _proxyAddress = await maker.service('proxy').ensureProxy();
  await dai.approveUnlimited(_proxyAddress);

  await mgr.openLockAndDraw(
    'ETH-A',
    ETH_A_COLLATERAL_AMOUNT,
    ETH_A_DEBT_AMOUNT
  );
  await mgr.openLockAndDraw(
    'BAT-A',
    BAT_A_COLLATERAL_AMOUNT,
    BAT_A_DEBT_AMOUNT
  );

  await sav.join(MDAI(1));
});

afterAll(async () => {
  await restoreSnapshot(snapshotData, maker);
});

test(COLLATERAL_TYPE_PRICE, async () => {
  const ethAPrice = await maker.latest(COLLATERAL_TYPE_PRICE, 'ETH-A');
  expect(ethAPrice.toNumber()).toEqual(180);
  expect(ethAPrice.symbol).toEqual('USD/ETH');
});

test(COLLATERAL_TYPES_PRICES, async () => {
  const [ethAPrice, batAPrice] = await maker.latest(COLLATERAL_TYPES_PRICES);

  expect(ethAPrice.toNumber()).toEqual(180);
  expect(batAPrice.toNumber()).toEqual(40);

  expect(ethAPrice.symbol).toEqual('USD/ETH');
  expect(batAPrice.symbol).toEqual('USD/BAT');
});

test(VAULT_TYPE_AND_ADDRESS, async () => {
  const cdpId = 1;
  const expectedVaultType = 'ETH-A';
  const expectedVaultAddress = '0x6D43e8f5A6D2b5aD2b242A1D3CF957C71AfC48a1';
  const [collateralType, vaultAddress] = await maker.latest(
    VAULT_TYPE_AND_ADDRESS,
    cdpId
  );
  expect(collateralType).toEqual(expectedVaultType);
  expect(vaultAddress).toEqual(expectedVaultAddress);
});

test(DEBT_VALUE, async () => {
  const cdpId = 1;
  const debtValue = await maker.latest(DEBT_VALUE, cdpId);
  const expected = MDAI(1);

  expect(debtValue.toNumber()).toEqual(expected.toNumber());
});

test(COLLATERAL_VALUE, async () => {
  const cdpId = 1;
  const collateralValue = await maker.latest(COLLATERAL_VALUE, cdpId);
  const expected = USD(180);

  expect(collateralValue.toString()).toEqual(expected.toString());
});

test(DAI_AVAILABLE, async () => {
  const cdpId = 1;
  const daiAvailable = await maker.latest(DAI_AVAILABLE, cdpId);
  const expected = MDAI(119);

  expect(daiAvailable.toString()).toEqual(expected.toString());
});

test(VAULT, async () => {
  const cdpId = 1;
  const expectedVaultType = 'ETH-A';
  const expectedVaultAddress = '0x6D43e8f5A6D2b5aD2b242A1D3CF957C71AfC48a1';
  const expectedEncumberedCollateral = fromWei(1000000000000000000);
  const expectedEncumberedDebt = fromWei(995000000000000000);
  const expectedDebtValue = MDAI(1);
  const expectedCollateralValue = USD(180);
  const expectedDaiAvailable = MDAI(119);
  const expectedColTypePrice = createCurrencyRatio(USD, ETH)(180);

  const vault = await maker.latest(VAULT, cdpId);

  expect(Object.keys(vault).length).toBe(8);

  expect(vault.vaultType).toEqual(expectedVaultType);
  expect(vault.vaultAddress).toEqual(expectedVaultAddress);
  expect(vault.encumberedCollateral).toEqual(expectedEncumberedCollateral);
  expect(vault.encumberedDebt.toNumber()).toBeCloseTo(
    expectedEncumberedDebt.toNumber()
  );
  expect(vault.collateralTypePrice.toString()).toEqual(
    expectedColTypePrice.toString()
  );
  expect(vault.debtValue.toString()).toEqual(expectedDebtValue.toString());
  expect(vault.collateralValue.toString()).toEqual(
    expectedCollateralValue.toString()
  );
  expect(vault.daiAvailable.toString()).toEqual(
    expectedDaiAvailable.toString()
  );
});

test(SAVINGS_DAI, async () => {
  const savingsDai = await maker.latest(SAVINGS_DAI, address);
  expect(savingsDai.symbol).toEqual('DSR-DAI');
  expect(savingsDai.toNumber()).toBeCloseTo(0.999795, 4);
});
