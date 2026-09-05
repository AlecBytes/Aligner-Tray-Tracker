import { enforceKnownExpiration, NO_PAID_ACCESS, resolvePremiumAccess } from './paid-access-service';
describe('paid access expiration', () => {
  it('cuts off an expired subscription', () => expect(enforceKnownExpiration({ hasPremiumAccess: true, isLifetime: false, expirationAt: 100 }, 100)).toEqual(NO_PAID_ACCESS));
  it('keeps an unexpired subscription and confirmed lifetime access', () => { expect(enforceKnownExpiration({ hasPremiumAccess: true, isLifetime: false, expirationAt: 101 }, 100).hasPremiumAccess).toBe(true); expect(enforceKnownExpiration({ hasPremiumAccess: true, isLifetime: true, expirationAt: null }, 100).hasPremiumAccess).toBe(true); });
  it('requires product evidence before treating a null expiration as lifetime', () => { expect(resolvePremiumAccess({ isActive: true, expirationAt: null, isLifetimeProduct: false })).toEqual(NO_PAID_ACCESS); expect(resolvePremiumAccess({ isActive: true, expirationAt: null, isLifetimeProduct: true }).isLifetime).toBe(true); });
  it('rejects inactive and expired grants', () => { expect(resolvePremiumAccess({ isActive: false, expirationAt: null, isLifetimeProduct: true })).toEqual(NO_PAID_ACCESS); expect(resolvePremiumAccess({ isActive: true, expirationAt: 100, isLifetimeProduct: false }, 100)).toEqual(NO_PAID_ACCESS); });
});
