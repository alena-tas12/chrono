const http = require('http');
const path = require('path');
const { startGoogleAuth } = require('../main/googleAuth');

// Attempt to mock Electron shell openExternal to prevent actual browser popup
try {
    const electron = require('electron');
    if (electron.shell) {
        electron.shell.openExternal = async (url) => {
            console.log(`[Mock Electron Shell] Intercepted openExternal: ${url}`);
            return true;
        };
    }
} catch (e) {
    console.warn("Could not patch electron.shell (read-only or missing):", e.message);
}

async function testOAuthLoopback() {
    console.log("🚀 Starting Google OAuth Redirect Loopback Test...");

    // Mock Supabase Client
    const mockSupabase = {
        auth: {
            signInWithOAuth: async ({ provider, options }) => {
                console.log(`[Mock Supabase] signInWithOAuth called for provider: ${provider}`);
                return {
                    data: {
                        provider: 'google',
                        url: `https://mock-google-login-provider.com/auth?redirect_to=${encodeURIComponent(options.redirectTo)}`
                    },
                    error: null
                };
            }
        }
    };

    // Set a timeout to emulate a user redirect callback after 1.5 seconds
    setTimeout(() => {
        console.log("➡️ Emulating callback redirect from Google Auth...");
        const callbackUrl = 'http://localhost:54321/save-token?access_token=test_google_jwt_token_456&refresh_token=test_google_refresh_token_789';
        
        http.get(callbackUrl, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`📥 Local server responded to token save: ${data}`);
            });
        }).on('error', (err) => {
            console.error("❌ Failed to send emulated callback request:", err.message);
        });
    }, 1500);

    try {
        const tokensPromise = startGoogleAuth(mockSupabase);
        
        console.log("⏳ Waiting for auth server to capture redirect...");
        const tokens = await tokensPromise;
        
        console.log("🎉 OAuth Promise Resolved successfully!");
        console.log("🔑 Captured Tokens:");
        console.log(`   - Access Token: ${tokens.accessToken}`);
        console.log(`   - Refresh Token: ${tokens.refreshToken}`);
        
        if (tokens.accessToken === 'test_google_jwt_token_456' && tokens.refreshToken === 'test_google_refresh_token_789') {
            console.log("✅ SUCCESS: Captured tokens match the emulated callback!");
            process.exit(0);
        } else {
            console.error("❌ FAILURE: Tokens mismatch!");
            process.exit(1);
        }
    } catch (err) {
        console.error("❌ Test Failed with error:", err.message || err);
        process.exit(1);
    }
}

testOAuthLoopback();
