/**
 * HTTP Client Utility
 *
 * Simple HTTP/HTTPS client wrapper with timeout support
 * Used for making requests to TongHop API
 */

const http = require('http');
const https = require('https');

/**
 * Make HTTP request with timeout
 * @param {string} url - Full URL to request
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (GET, POST, etc.)
 * @param {Object} [options.headers] - HTTP headers
 * @param {Object|string} [options.body] - Request body (auto-stringified if object)
 * @param {number} [options.timeout] - Timeout in milliseconds (default: 3000)
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            timeout: options.timeout || 3000
        };

        // Prepare body if provided
        let body = '';
        if (options.body) {
            body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            requestOptions.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = client.request(requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    // Try to parse as JSON
                    const jsonData = data ? JSON.parse(data) : {};

                    // Check if response is OK (2xx status)
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonData);
                    } else {
                        const error = new Error(jsonData.message || `HTTP Error ${res.statusCode}`);
                        error.statusCode = res.statusCode;
                        error.response = jsonData;
                        reject(error);
                    }
                } catch (parseError) {
                    reject(new Error(`Failed to parse response: ${parseError.message}`));
                }
            });
        });

        // Handle request timeout
        req.on('timeout', () => {
            req.destroy();
            const error = new Error(`Request timeout after ${requestOptions.timeout}ms`);
            error.code = 'ETIMEDOUT';
            reject(error);
        });

        // Handle request errors
        req.on('error', (error) => {
            reject(error);
        });

        // Write body if provided
        if (body) {
            req.write(body);
        }

        req.end();
    });
}

/**
 * Make GET request
 * @param {string} url - URL to fetch
 * @param {Object} [options] - Request options
 * @returns {Promise<Object>}
 */
async function get(url, options = {}) {
    return request(url, { ...options, method: 'GET' });
}

/**
 * Make POST request
 * @param {string} url - URL to post to
 * @param {Object} body - Request body
 * @param {Object} [options] - Request options
 * @returns {Promise<Object>}
 */
async function post(url, body, options = {}) {
    return request(url, { ...options, method: 'POST', body });
}

/**
 * Make PUT request
 * @param {string} url - URL to put to
 * @param {Object} body - Request body
 * @param {Object} [options] - Request options
 * @returns {Promise<Object>}
 */
async function put(url, body, options = {}) {
    return request(url, { ...options, method: 'PUT', body });
}

/**
 * Make DELETE request
 * @param {string} url - URL to delete
 * @param {Object} [options] - Request options
 * @returns {Promise<Object>}
 */
async function del(url, options = {}) {
    return request(url, { ...options, method: 'DELETE' });
}

/**
 * Sleep for a given time
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    request,
    get,
    post,
    put,
    delete: del,
    sleep
};
