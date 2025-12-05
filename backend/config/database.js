/**
 * Database Configuration
 * SQL Server connection setup
 */

const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let poolPromise;

/**
 * Get database connection pool
 */
const getPool = async () => {
    if (!poolPromise) {
        try {
            poolPromise = sql.connect(config);
            console.log('✅ Đã kết nối SQL Server');
        } catch (error) {
            console.error('❌ Lỗi kết nối SQL Server:', error.message);
            poolPromise = null;
            throw error;
        }
    }
    return poolPromise;
};

/**
 * Execute SQL query
 */
const query = async (sqlQuery, params = {}) => {
    try {
        const pool = await getPool();
        const request = pool.request();

        // Add parameters
        Object.keys(params).forEach(key => {
            request.input(key, params[key]);
        });

        const result = await request.query(sqlQuery);
        return result.recordset;
    } catch (error) {
        console.error('Query error:', error);
        throw error;
    }
};

/**
 * Execute SQL query and return single record
 */
const queryOne = async (sqlQuery, params = {}) => {
    const results = await query(sqlQuery, params);
    return results.length > 0 ? results[0] : null;
};

/**
 * Close database connection
 */
const closePool = async () => {
    if (poolPromise) {
        const pool = await poolPromise;
        await pool.close();
        poolPromise = null;
        console.log('Đã đóng kết nối SQL Server');
    }
};

module.exports = {
    sql,
    getPool,
    query,
    queryOne,
    closePool,
    config
};
