import pool from '../db.js';

export async function saveRefreshToken(userId, jti, expiresAt) {
  try {
    await pool.query(
      'INSERT INTO refresh_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3)',
      [jti, userId, expiresAt]
    );
  } catch (err){
    console.error('saveRefreshToken error: ', err);
    throw err;
  }
}

export async function getRefreshTokenByJti(jti) {
  const res = await pool.query('SELECT * FROM refresh_tokens WHERE jti = $1', [jti]);
  return res.rows[0];
}

export async function revokeRefreshTokenByJti(jti) {
  await pool.query('UPDATE refresh_tokens SET revoked = true WHERE jti = $1', [jti]);
}