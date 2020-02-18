import { PROXY_ADDRESS, PROXY_OWNER } from './constants';

export const proxyRegistryProxies = {
  generate: address => ({
    id: `PROXY_REGISTRY.proxies(${address})`,
    contract: 'PROXY_REGISTRY',
    call: ['proxies(address)(address)', address],
    transforms: {
      [PROXY_ADDRESS]: proxyAddress =>
        proxyAddress === '0x0000000000000000000000000000000000000000'
          ? null
          : proxyAddress
    }
  }),
  returns: [[PROXY_ADDRESS]]
};

// TODO: throw an error if the DSProxy contract doesn't exist
//       could use new multicall onError event listener
export const proxyGetOwner = {
  generate: address => ({
    id: `DS_PROXY.owner(${address})`,
    target: address,
    call: ['owner()(address)']
  }),
  returns: [[PROXY_OWNER]]
};

export default {
  proxyRegistryProxies,
  proxyGetOwner
};
