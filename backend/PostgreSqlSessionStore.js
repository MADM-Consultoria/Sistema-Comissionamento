// backend/PostgreSqlSessionStore.js
import session from 'express-session';

const DUMMY_USER_UUID = '00000000-0000-0000-0000-000000000000';

export class PostgreSqlSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    this.pool.on('error', (err) => {
      console.error('❌ Erro no pool PostgreSQL (store):', err);
      this.emit('disconnect');
    });
  }

  get(sid, callback) {
    const query = `
      SELECT dados_sessao, expira_em, status_sessao
      FROM app_comissionamento.sessoes_app
      WHERE sid = $1
        AND status_sessao = 'ATIVA'
        AND expira_em > NOW()
    `;
    this.pool.query(query, [sid], (err, result) => {
      if (err) return callback(err);
      if (result.rows.length === 0) return callback(null, null);
      const row = result.rows[0];
      try {
        const sessionData = typeof row.dados_sessao === 'string'
          ? JSON.parse(row.dados_sessao)
          : row.dados_sessao;
        callback(null, sessionData);
      } catch (e) {
        callback(e);
      }
    });
  }

  set(sid, sessionData, callback) {
    const now = new Date();
    let expiraEm;
    if (sessionData.cookie?.expires) {
      expiraEm = new Date(sessionData.cookie.expires);
    } else if (sessionData.cookie?.maxAge) {
      expiraEm = new Date(Date.now() + sessionData.cookie.maxAge);
    } else {
      expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const dadosSessao = JSON.stringify(sessionData);
    const usuarioId = DUMMY_USER_UUID;
    const ip = sessionData.ip || null;
    const userAgent = sessionData.userAgent || null;

    const query = `
      INSERT INTO app_comissionamento.sessoes_app
        (sid, usuario_id, dados_sessao, ip_address, user_agent,
         login_em, ultima_atividade_em, expira_em, status_sessao, criado_em)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ATIVA', $7)
      ON CONFLICT (sid) DO UPDATE SET
        usuario_id = EXCLUDED.usuario_id,
        dados_sessao = EXCLUDED.dados_sessao,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        ultima_atividade_em = EXCLUDED.ultima_atividade_em,
        expira_em = EXCLUDED.expira_em,
        status_sessao = 'ATIVA'
    `;
    const values = [sid, usuarioId, dadosSessao, ip, userAgent, now, now, expiraEm];
    this.pool.query(query, values, callback);
  }

  destroy(sid, callback) {
    // Atualiza status, datas de logout e calcula duração em segundos
    const query = `
      UPDATE app_comissionamento.sessoes_app
      SET status_sessao = 'LOGOUT',
          logout_em = NOW(),
          encerrada_em = NOW(),
          motivo_encerramento = 'logout',
          duracao_segundos = EXTRACT(EPOCH FROM (NOW() - login_em))::bigint
      WHERE sid = $1
    `;
    this.pool.query(query, [sid], (err) => {
      if (err) {
        console.error('❌ [SessionStore] Erro ao destruir sessão:', err);
        return callback(err);
      }
      console.log('✅ [SessionStore] Sessão finalizada com sucesso');
      callback(null);
    });
  }

  touch(sid, sessionData, callback) {
    let expiraEm;
    if (sessionData.cookie?.expires) {
      expiraEm = new Date(sessionData.cookie.expires);
    } else if (sessionData.cookie?.maxAge) {
      expiraEm = new Date(Date.now() + sessionData.cookie.maxAge);
    } else {
      expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    const query = `
      UPDATE app_comissionamento.sessoes_app
      SET ultima_atividade_em = NOW(),
          expira_em = $2,
          status_sessao = 'ATIVA'
      WHERE sid = $1
    `;
    this.pool.query(query, [sid, expiraEm], callback);
  }
}