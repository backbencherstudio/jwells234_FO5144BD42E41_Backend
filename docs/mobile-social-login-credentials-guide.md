# Mobile Social Login Credentials Guide (Flutter Client)

This guide explains exactly how to collect and send the credentials needed for mobile social login.

## Backend env keys to fill

```env
# Google Sign-In (Android + iOS)
GOOGLE_ANDROID_APP_ID=
GOOGLE_IOS_APP_ID=
GOOGLE_MOBILE_APP_IDS=

# Apple Sign-In (iOS)
APPLE_CLIENT_ID=
APPLE_MOBILE_CLIENT_IDS=
```

## Important notes before setup

- For this backend, these values are audience values used to verify ID tokens.
- These are OAuth Client IDs / Service IDs, not app package names (except Apple native iOS often uses Bundle ID as audience).
- Your mobile login currently requires location for non-admin users.

---

## 1) GOOGLE CREDENTIALS (where to get them)

### 1.1 Open Google Cloud Console

1. Go to https://console.cloud.google.com
2. Select the correct project used by your Flutter app.
3. Go to APIs and Services -> Credentials.

### 1.2 Create/get Android OAuth client ID

1. Click Create Credentials -> OAuth client ID.
2. Application type: Android.
3. Fill package name and SHA-1 certificate fingerprint.
4. Save.
5. Copy the generated Client ID (looks like `12345-xxxxx.apps.googleusercontent.com`).

Put this into:

```env
GOOGLE_ANDROID_APP_ID=<android_oauth_client_id>
```

### 1.3 Create/get iOS OAuth client ID

1. Click Create Credentials -> OAuth client ID.
2. Application type: iOS.
3. Fill Bundle ID.
4. Save.
5. Copy the generated Client ID.

Put this into:

```env
GOOGLE_IOS_APP_ID=<ios_oauth_client_id>
```

### 1.4 Optional extra Google audiences

If Flutter uses `serverClientId` or returns a token with a different `aud`, add those IDs in comma-separated format.

```env
GOOGLE_MOBILE_APP_IDS=<web_or_server_client_id_1>,<optional_client_id_2>
```

## 2) APPLE CREDENTIALS (where to get them)

### 2.1 Open Apple Developer account

1. Go to https://developer.apple.com/account
2. Select the team/app used by your Flutter iOS app.

### 2.2 Confirm Sign In with Apple capability

1. Go to Certificates, Identifiers and Profiles.
2. Open your iOS App ID (Bundle ID).
3. Ensure Sign In with Apple capability is enabled.

### 2.3 Determine Apple audience value for your app

For native iOS sign-in, token audience is usually your Bundle ID.
For web/Android relay flows, audience can be a Service ID.

Primary value goes here:

```env
APPLE_CLIENT_ID=<bundle_id_or_service_id_used_as_aud>
```

Optional additional audiences:

```env
APPLE_MOBILE_CLIENT_IDS=<extra_audience_1>,<extra_audience_2>
```

## 3) EXACT REQUEST JSON BODY FOR LOGIN

Base URL example:

- `POST /api/auth/google/mobile`
- `POST /api/auth/apple/mobile`

### 3.1 Google mobile login body

Use this exact field name for token: `idToken`

```json
{
  "idToken": "<google_id_token>",
  "latitude": 23.8103,
  "longitude": 90.4125
}
```

Accepted token aliases may exist in strategy, but due request validation policy you should always send `idToken`.

### 3.2 Apple mobile login body

Use this exact field name for token: `identityToken`

```json
{
  "identityToken": "<apple_identity_token>",
  "email": "optional-first-login@example.com",
  "firstName": "Optional",
  "lastName": "Optional",
  "latitude": 23.8103,
  "longitude": 90.4125
}
```

Notes:

- Apple may provide email only on first authorization.
- If available, send `email`, `firstName`, and `lastName` on first login.

---

## 4) QUICK VALIDATION CHECKLIST

After setting env and deploying backend:

1. Restart backend service.
2. Test Google mobile endpoint with real device token.
3. Test Apple mobile endpoint with real device token.
4. Confirm login succeeds and returns authorization tokens.
5. Confirm user record is linked by `google_id` or `apple_id`.

---

## 5) Copy/paste request examples for Flutter team

### Google

```http
POST /api/auth/google/mobile
Content-Type: application/json

{
  "idToken": "<token>",
  "latitude": 23.8103,
  "longitude": 90.4125
}
```

### Apple

```http
POST /api/auth/apple/mobile
Content-Type: application/json

{
  "identityToken": "<token>",
  "email": "optional@appleuser.com",
  "firstName": "Optional",
  "lastName": "Optional",
  "latitude": 23.8103,
  "longitude": 90.4125
}
```
