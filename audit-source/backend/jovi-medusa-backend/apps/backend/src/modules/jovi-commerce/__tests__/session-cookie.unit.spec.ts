import { resolveCookieOptions } from '../session-cookie'

describe('Admin session cookie resolution and fail-closed guard', () => {
  test('defaults to secure=true when loopback override is not enabled (production/HTTPS baseline)', () => {
    const opts = resolveCookieOptions({})
    expect(opts).toEqual({
      sameSite: 'lax',
      httpOnly: true,
      secure: true,
    })
  })

  test('allows secure=false ONLY under synthetic loopback HTTP', () => {
    const opts = resolveCookieOptions({
      JOVI_SYNTHETIC_LOOPBACK_HTTP: 'true',
    })
    expect(opts).toEqual({
      sameSite: 'lax',
      httpOnly: true,
      secure: false,
    })
  })

  test('fails closed if synthetic loopback override is combined with real commerce', () => {
    expect(() =>
      resolveCookieOptions({
        JOVI_SYNTHETIC_LOOPBACK_HTTP: 'true',
        JOVI_REAL_COMMERCE: 'true',
      })
    ).toThrow('SYNTHETIC_LOOPBACK_COOKIE_OVERRIDE_FORBIDDEN_IN_REAL_COMMERCE')
  })

  test('fails closed if synthetic loopback override is combined with production integration', () => {
    expect(() =>
      resolveCookieOptions({
        JOVI_SYNTHETIC_LOOPBACK_HTTP: 'true',
        PRODUCTION_INTEGRATION_ALLOWED: 'true',
      })
    ).toThrow('SYNTHETIC_LOOPBACK_COOKIE_OVERRIDE_FORBIDDEN_IN_REAL_COMMERCE')
  })

  test('fails closed if synthetic loopback override is combined with real payment', () => {
    expect(() =>
      resolveCookieOptions({
        JOVI_SYNTHETIC_LOOPBACK_HTTP: 'true',
        REAL_PAYMENT_ALLOWED: 'true',
      })
    ).toThrow('SYNTHETIC_LOOPBACK_COOKIE_OVERRIDE_FORBIDDEN_IN_REAL_COMMERCE')
  })
})
