# Error Log: User Flows

This document records the errors encountered while testing the local user flows (excluding Gemini AI flows) using the E2E Playwright test suite.
Out of 10 tests, 4 passed and 6 failed.

## Admin Flow Failures

1. **A/B Testing Dashboard**
   - **Error**: `locator('text=Homepage Test').toBeVisible()` failed.
   - **Details**: The A/B testing dashboard did not load the expected "Homepage Test" experiment. The mock data or component might be missing.

2. **B2B Portal**
   - **Error**: `locator('text=Acme Corp').toBeVisible()` failed.
   - **Details**: The B2B portal did not display the expected company "Acme Corp".

3. **Store Builder Access**
   - **Error**: Expected URL to be `/builder` but received `/login`.
   - **Details**: The user is incorrectly redirected back to the login page when trying to access the store builder.

## Storefront Flow Failures

4. **AR/3D Product Viewer**
   - **Error**: `locator('model-viewer').toBeVisible()` failed.
   - **Details**: The `<model-viewer>` element was not found on the page when AR is enabled, indicating the 3D model component is missing or not rendering.

5. **Voice Commerce Chatbot**
   - **Error**: `locator('button[aria-label="Voice Input"]').toBeAttached()` failed.
   - **Details**: The voice input microphone button is missing from the storefront, preventing users from interacting with the chatbot via voice.

## Super Admin Flow Failures

6. **Tenants List View**
   - **Error**: Expected URL to be `/tenants` but received `/login`.
   - **Details**: Accessing the `/tenants` page incorrectly redirects the super admin back to the login page, despite a prior successful login.

## Passing Flows
The following flows were tested and are **working correctly**:
- Admin login with valid credentials
- Admin login error state with invalid credentials
- Storefront item add to cart and checkout
- Super admin login success with valid credentials
