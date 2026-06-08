const http = require('http');
const url = require('url');
const { shell } = require('electron');

/**
 * Starts a temporary local loopback server on port 54321.
 * Fetches the Google OAuth sign-in URL from Supabase, opens it in the user's browser,
 * listens for the redirect callback, extracts the access/refresh tokens, and closes itself.
 * 
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {Promise<{accessToken: string, refreshToken: string, providerToken: string}>}
 */
async function startGoogleAuth(supabaseClient) {
    return new Promise((resolve, reject) => {
        const port = 54321;
        let server;
        let timeoutId;

        // Clean closure helper
        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (server) {
                server.close(() => {
                    console.log("🔒 Google Auth local listener closed.");
                });
            }
        };

        server = http.createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true);

            // Handle the standard redirect callback
            if (parsedUrl.pathname === '/callback') {
                // Serve a premium page with custom styling to extract the hash parameters (which are client-side only)
                // and POST/GET them back to the server.
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Chrono Auth Success</title>
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
                        <style>
                            body {
                                font-family: 'Outfit', sans-serif;
                                background-color: #0f172a;
                                color: #f8fafc;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                            }
                            .card {
                                background: #1e293b;
                                border: 1px solid #334155;
                                padding: 40px;
                                border-radius: 16px;
                                max-width: 420px;
                                width: 90%;
                                text-align: center;
                                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
                            }
                            .logo {
                                width: 48px;
                                height: 48px;
                                border-radius: 12px;
                                background: #3f75ff;
                                color: white;
                                font-weight: 800;
                                font-size: 24px;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                margin-bottom: 24px;
                                box-shadow: 0 4px 10px rgba(63, 117, 255, 0.3);
                            }
                            h2 {
                                margin: 0 0 10px 0;
                                font-size: 22px;
                                font-weight: 700;
                            }
                            p {
                                font-size: 14px;
                                color: #94a3b8;
                                line-height: 1.5;
                                margin: 0 0 24px 0;
                            }
                            .spinner {
                                border: 3px solid rgba(255, 255, 255, 0.05);
                                width: 28px;
                                height: 28px;
                                border-radius: 50%;
                                border-left-color: #3f75ff;
                                animation: spin 1s linear infinite;
                                display: inline-block;
                            }
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                            .success-icon {
                                color: #10b981;
                                font-size: 40px;
                                margin-bottom: 16px;
                                display: none;
                            }
                            .error-icon {
                                color: #ef4444;
                                font-size: 40px;
                                margin-bottom: 16px;
                                display: none;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div id="loader" class="spinner"></div>
                            <div id="success" class="success-icon">✓</div>
                            <div id="error" class="error-icon">✗</div>
                            <div class="logo" id="logoText">C</div>
                            <h2 id="title">Completing Sign-In</h2>
                            <p id="msg">Exchanging authentication tokens with Chrono...</p>
                        </div>
                        <script>
                            const hash = window.location.hash;
                            if (hash) {
                                const params = new URLSearchParams(hash.substring(1));
                                                               const accessToken = params.get('access_token');
                                const refreshToken = params.get('refresh_token');
                                const providerToken = params.get('provider_token');
                                
                                if (accessToken) {
                                    fetch('/save-token?access_token=' + encodeURIComponent(accessToken) + 
                                          '&refresh_token=' + encodeURIComponent(refreshToken) + 
                                          '&provider_token=' + encodeURIComponent(providerToken || ''))
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.success) {
                                                document.getElementById('loader').style.display = 'none';
                                                document.getElementById('success').style.display = 'block';
                                                document.getElementById('title').innerText = 'Welcome Back!';
                                                document.getElementById('title').style.color = '#10b981';
                                                document.getElementById('msg').innerText = 'Your Google account was linked successfully. You can close this tab and return to the Chrono app.';
                                            } else {
                                                throw new Error(data.message || 'Saving token failed');
                                            }
                                        })
                                        .catch(err => {
                                            showError(err.message);
                                        });
                                } else {
                                    showError('Access token is missing from the authentication URL.');
                                }
                            } else {
                                showError('Authentication parameters could not be read from the URL.');
                            }

                            function showError(errText) {
                                document.getElementById('loader').style.display = 'none';
                                document.getElementById('error').style.display = 'block';
                                document.getElementById('title').innerText = 'Authentication Failed';
                                document.getElementById('title').style.color = '#ef4444';
                                document.getElementById('msg').innerText = errText;
                            }
                        </script>
                    </body>
                    </html>
                `);
            } 
            // Handle saving the token to local Electron environment
            else if (parsedUrl.pathname === '/save-token') {
                                const accessToken = parsedUrl.query.access_token;
                                const refreshToken = parsedUrl.query.refresh_token;
                                const providerToken = parsedUrl.query.provider_token;
                
                                if (!accessToken) {
                                    res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                    res.end(JSON.stringify({ success: false, message: 'Missing access_token' }));
                                    return;
                                }
                
                                // Send 200 response to browser
                                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                                res.end(JSON.stringify({ success: true }));
                
                                // Resolve promise and teardown loopback server
                                setTimeout(() => {
                                    cleanup();
                                    resolve({ accessToken, refreshToken, providerToken });
                                }, 800);
                            } 
            // Handle any other requests
            else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });

        // Set safety timeout (3 minutes)
        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("Sign-in process timed out. Please try again."));
        }, 180000);

        // Start listening
        server.listen(port, 'localhost', async (err) => {
            if (err) {
                cleanup();
                reject(err);
                return;
            }
            console.log(`🔑 Google Auth local listener started on http://localhost:${port}`);

            try {
                // Initialize Supabase OAuth redirect URL
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: `http://localhost:${port}/callback`,
                        skipBrowserRedirect: true,
                        scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly',
                        queryParams: {
                            access_type: 'offline',
                            prompt: 'consent'
                        }
                    }
                });

                if (error) {
                    cleanup();
                    reject(error);
                    return;
                }

                if (!data || !data.url) {
                    cleanup();
                    reject(new Error("Supabase auth did not return an OAuth URL."));
                    return;
                }

                // Open the Google OAuth URL in user's default browser
                console.log(`🔗 Opening default browser for Google OAuth: ${data.url}`);
                await shell.openExternal(data.url);

            } catch (authErr) {
                cleanup();
                reject(authErr);
            }
        });
    });
}

module.exports = {
    startGoogleAuth
};
