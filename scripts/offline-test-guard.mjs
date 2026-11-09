// Test preload: permit loopback/Unix sockets only, before application modules load.
import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
const local = host => host === 'localhost' || host === '::1' || host === '[::1]' ||
  net.isIP(host) === 4 && host.startsWith('127.');
const refuse = () => { throw new Error('OFFLINE_TEST_NETWORK_BLOCKED'); };
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, ...args) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['http:', 'https:'].includes(url.protocol) || !local(url.hostname)) return Promise.reject(new Error('OFFLINE_TEST_NETWORK_BLOCKED'));
  return originalFetch(input, ...args);
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = values[0];
  if (typeof options === 'object' && options?.path) return connect.apply(this, args);
  if (typeof options === 'string' && options.startsWith('/')) return connect.apply(this, args);
  const host = typeof options === 'object' ? options.host ?? options.hostname ?? 'localhost' :
    typeof values[1] === 'string' ? values[1] : 'localhost';
  if (!local(host)) refuse();
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = (host, ...args) => { if (!local(host)) refuse(); return lookup(host, ...args); };
dgram.createSocket = refuse;
syncBuiltinESMExports();
