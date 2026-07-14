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
    console.log(`🔍 [SessionStore] get chamado para sid: ${sid}`);
    const query = `
      SELECT dados_sessao, expira_em, status_sessao
      FROM app_comissionamento.sessoes_app
      WHERE sid = $1
        AND status_sessao = 'ATIVA'
        AND expira_em > NOW()
    `;
    this.pool.query(query, [sid], (err, result) => {
      if (err) {
        console.error('❌ [SessionStore] Erro ao buscar sessão:', err);
        return callback(err);
      }
      if (result.rows.length === 0) {
        console.log('ℹ️ [SessionStore] Nenhuma sessão ativa encontrada para sid:', sid);
        return callback(null, null);
      }
      const row = result.rows[0];
      try {
        const sessionData = typeof row.dados_sessao === 'string'
          ? JSON.parse(row.dados_sessao)
          : row.dados_sessao;
        console.log('✅ [SessionStore] Sessão recuperada com sucesso');
        callback(null, sessionData);
      } catch (e) {
        console.error('❌ [SessionStore] Erro ao fazer parse da sessão:', e);
        callback(e);
      }
    });
  }

  set(sid, sessionData, callback) {
    console.log(`💾 [SessionStore] set chamado para sid: ${sid}`);
    const now = new Date();
    let expiraEm;
    if (sessionData.cookie?.expires) {
      expiraEm = new Date(sessionData.cookie.expires);
    } else if (sessionData.cookie?.maxAge) {
      expiraEm = new Date(Date.now() + sessionData.cookie.maxAge);
    } else {
      expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h padrão
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

    this.pool.query(query, values, (err) => {
      if (err) {
        console.error('❌ [SessionStore] Erro ao salvar sessão:', err);
        return callback(err);
      }
      console.log('✅ [SessionStore] Sessão salva/atualizada com sucesso');
      callback(null);
    });
  }

  destroy(sid, callback) {
    console.log(`🗑️ [SessionStore] destroy chamado para sid: ${sid}`);
    const query = `
      UPDATE app_comissionamento.sessoes_app
      SET status_sessao = 'LOGOUT',
          encerrada_em = NOW(),
          motivo_encerramento = 'logout'
      WHERE sid = $1
      RETURNING sid, status_sessao, encerrada_em, motivo_encerramento
    `;
    this.pool.query(query, [sid], (err, result) => {
      if (err) {
        console.error('❌ [SessionStore] Erro ao destruir sessão:', err);
        return callback(err);
      }
      if (result.rows.length === 0) {
        console.warn('⚠️ [SessionStore] Nenhuma sessão encontrada para destruir com sid:', sid);
      } else {
        console.log('✅ [SessionStore] Sessão marcada como LOGOUT:', result.rows[0]);
      }
      callback(null);
    });
  }

  touch(sid, sessionData, callback) {
    console.log(`🔄 [SessionStore] touch chamado para sid: ${sid}`);
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
    this.pool.query(query, [sid, expiraEm], (err) => {
      if (err) {
        console.error('❌ [SessionStore] Erro ao atualizar atividade:', err);
        return callback(err);
      }
      console.log('✅ [SessionStore] Atividade renovada');
      callback(null);
    });
  }
}