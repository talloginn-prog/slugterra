import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { encode } from '@auth/core/jwt';
import { configuredProviders, getSocialAccount, handleSocialAuth, SITE_ORIGIN } from '../server/social-auth.js';

// Public, local test fixtures only. Never configure these as production secrets.
const env = { AUTH_SECRET: 'local-protocol-fixture-not-a-production-secret', GOOGLE_CLIENT_ID: 'google-fixture', GOOGLE_CLIENT_SECRET: 'google-fixture-public', MICROSOFT_CLIENT_ID: 'microsoft-fixture', MICROSOFT_CLIENT_SECRET: 'microsoft-fixture-public' };
const cookies = response => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
const cookieHeaders = cookie => ({ cookie });

async function providerFixture(provider, badNonce = false) {
  const { publicKey, privateKey } = await generateKeyPair('RS256'), jwk = { ...await exportJWK(publicKey), alg: 'RS256', use: 'sig', kid: 'fixture' };
  const microsoft = provider === 'microsoft', id = microsoft ? 'microsoft-entra-id' : 'google';
  const issuer = microsoft ? 'https://login.microsoftonline.com/common/v2.0' : 'https://accounts.google.com';
  const authorization = microsoft ? 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' : 'https://accounts.google.com/o/oauth2/v2/auth';
  const tokenURL = microsoft ? 'https://login.microsoftonline.com/common/oauth2/v2.0/token' : 'https://oauth2.googleapis.com/token';
  let nonce, tokenCalls = 0;
  const providerFetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('.well-known/openid-configuration')) {
      const currentIssuer = microsoft && !url.includes('/common/') ? url.split('/.well-known')[0] : issuer;
      return Response.json({ issuer: currentIssuer, authorization_endpoint: authorization, token_endpoint: tokenURL, userinfo_endpoint: `${issuer}/userinfo`, jwks_uri: `${issuer}/keys`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'] });
    }
    if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
    if (url === tokenURL) {
      tokenCalls++; const body = new URLSearchParams(init.body);
      assert.equal(body.get('code'), 'fixture-code'); assert.ok(body.get('code_verifier')?.length >= 43);
      assert.equal(body.get('redirect_uri'), `${SITE_ORIGIN}/auth/callback/${id}`);
      const tid = '9188040d-6c67-4c5b-b112-36a304b66dad';
      const token = await new SignJWT({ sub: 'stable-player', name: 'Fixture Slugslinger', nonce: badNonce ? 'wrong-nonce' : nonce, ...(microsoft ? { tid } : {}) })
        .setProtectedHeader({ alg:'RS256',kid:'fixture' }).setIssuer(microsoft ? `https://login.microsoftonline.com/${tid}/v2.0` : issuer)
        .setAudience(microsoft ? env.MICROSOFT_CLIENT_ID : env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('5m').sign(privateKey);
      return Response.json({ token_type:'Bearer',access_token:'public-fixture-access-token',expires_in:300,id_token:token });
    }
    throw Error('Unexpected provider request: '+url);
  };
  const start = await handleSocialAuth(new Request(`${SITE_ORIGIN}/login/${provider}`), env, { providerFetch });
  assert.equal(start.status,302); const destination = new URL(start.headers.get('location'));
  assert.equal(destination.origin,new URL(authorization).origin); assert.equal(destination.searchParams.get('code_challenge_method'),'S256');
  assert.ok(destination.searchParams.get('state')); nonce=destination.searchParams.get('nonce');assert.ok(nonce);
  assert.equal(destination.searchParams.get('redirect_uri'),`${SITE_ORIGIN}/auth/callback/${id}`);
  for(const value of start.headers.getSetCookie().filter(v=>/state=|nonce=|pkce.code_verifier=/.test(v))){assert.match(value,/HttpOnly/i);assert.match(value,/Secure/i);}
  const callback = async state => handleSocialAuth(new Request(`${SITE_ORIGIN}/auth/callback/${id}?code=fixture-code&state=${encodeURIComponent(state ?? destination.searchParams.get('state'))}`, {headers:cookieHeaders(cookies(start))}),env,{providerFetch});
  return { callback, id, get tokenCalls(){return tokenCalls;} };
}

for(const provider of ['google','microsoft'])test(`${provider}: direct PKCE/state/nonce exchange creates an encrypted HttpOnly session with stable account identity`,async()=>{
  const fixture=await providerFixture(provider), response=await fixture.callback();assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),SITE_ORIGIN+'/');assert.match(response.headers.get('cache-control'),/no-store/);
  const sessionCookies=response.headers.getSetCookie().filter(v=>v.startsWith('__Secure-authjs.session-token'));
  assert.ok(sessionCookies.length);for(const c of sessionCookies){assert.match(c,/HttpOnly/i);assert.match(c,/Secure/i);}
  const account=await getSocialAccount(new Request(SITE_ORIGIN+'/api/account',{headers:cookieHeaders(cookies(response))}),env);
  assert.deepEqual(account,{id:`${fixture.id}:stable-player`,name:'Fixture Slugslinger',provider:fixture.id});
});

test('OAuth callbacks reject changed state and mismatched nonce without issuing a session',async()=>{
  const stateFixture=await providerFixture('google'),badState=await stateFixture.callback('attacker-state');
  assert.match(badState.headers.get('location'),/account=error/);assert.equal(stateFixture.tokenCalls,0);
  const nonceFixture=await providerFixture('google',true),badNonce=await nonceFixture.callback();
  assert.match(badNonce.headers.get('location'),/account=error/);
  assert.equal(await getSocialAccount(new Request(SITE_ORIGIN+'/api/account',{headers:cookieHeaders(cookies(badNonce))}),env),null);
});

test('unconfigured sign-in is unavailable, spoofed identity headers are ignored, and tampered/expired sessions are rejected',async()=>{
  assert.deepEqual(configuredProviders({}),{google:false,microsoft:false});
  assert.equal(configuredProviders({...env,MICROSOFT_TENANT_ID:'https://other.test'}).microsoft,false);
  assert.equal((await handleSocialAuth(new Request(SITE_ORIGIN+'/login/google'),{})).status,503);
  assert.equal(await getSocialAccount(new Request(SITE_ORIGIN+'/api/account',{headers:{'oai-authenticated-user-id':'victim'}}),env),null);
  const expired=await encode({secret:env.AUTH_SECRET,salt:'__Secure-authjs.session-token',maxAge:-60,token:{sub:'google:old',provider:'google'}});
  for(const value of ['tampered',expired])assert.equal(await getSocialAccount(new Request(SITE_ORIGIN+'/api/account',{headers:{cookie:`__Secure-authjs.session-token=${value}`}}),env),null);
});

test('sign-out requires a same-origin POST and clears the session; unknown auth hosts are rejected',async()=>{
  assert.equal((await handleSocialAuth(new Request(SITE_ORIGIN+'/login/signout'),env)).status,405);
  assert.equal((await handleSocialAuth(new Request(SITE_ORIGIN+'/login/signout',{method:'POST',headers:{Origin:'https://other.test'}}),env)).status,403);
  const token=await encode({secret:env.AUTH_SECRET,salt:'__Secure-authjs.session-token',token:{sub:'google:one',provider:'google'}});
  const response=await handleSocialAuth(new Request(SITE_ORIGIN+'/login/signout',{method:'POST',headers:{Origin:SITE_ORIGIN,cookie:`__Secure-authjs.session-token=${token}`}}),env);
  assert.equal(response.status,302);assert.ok(response.headers.getSetCookie().some(v=>v.startsWith('__Secure-authjs.session-token=;')&&/Max-Age=0/.test(v)));
  assert.equal((await handleSocialAuth(new Request('https://other.test/login/google'),env)).status,400);
});
