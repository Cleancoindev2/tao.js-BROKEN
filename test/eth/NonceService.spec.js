import { buildTestNonceService } from '../helpers/serviceBuilders';

let nonceService;

beforeEach(async () => {
  nonceService = buildTestNonceService();
  await nonceService.manager().authenticate();
  nonceService.setNextNonce();
});

test('should properly fetch the transaction count', async () => {
  const count = await nonceService._getTxCount();
  console.log(count);
  expect(typeof count).toEqual('number');
});

test('should inject the nonce in the proper place in args list', async () => {
  const firstArgs = await nonceService.inject(['a', 2, { gasLimit: 400000 }]);
  const secondArgs = await nonceService.inject(['0x']);
  const thirdArgs = await nonceService.inject([
    '0x',
    { _bn: 'some BigNumber' }
  ]);

  expect(Object.keys(firstArgs[firstArgs.length - 1]).includes('nonce')).toBe(
    true
  );
  expect(secondArgs.length).toEqual(2);
  expect(typeof secondArgs[secondArgs.length - 1]).toEqual('object');
  expect(Object.keys(secondArgs[secondArgs.length - 1]).includes('nonce')).toBe(
    true
  );
  expect(thirdArgs.length).toEqual(3);
  expect(Object.keys(thirdArgs[thirdArgs.length - 1]).includes('nonce')).toBe(
    true
  );
  expect(Object.keys(thirdArgs[thirdArgs.length - 1]).includes('_bn')).toBe(
    false
  );
});

test('should properly initialize the count in state', async () => {
  const originalCount = nonceService._count;
  nonceService._count = undefined;
  await nonceService.setNextNonce();

  expect(nonceService._count).toEqual(originalCount);
});

test('should return its own tx count if higher than count from node', async () => {
  nonceService._count = 500000;
  const nonce = await nonceService.getNonce();

  expect(nonce).toEqual(500000);
});

test('should return tx count from node if higher than own count', async () => {
  nonceService._count = 0;
  const nonce = await nonceService.getNonce();

  expect(nonce).not.toEqual(0);
});

test('should return a nonce even when own count is undefined', async () => {
  nonceService._count = undefined;
  const nonce = await nonceService.getNonce();

  expect(typeof nonce).toEqual('number');
});
