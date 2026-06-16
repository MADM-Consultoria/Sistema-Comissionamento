// main.js - Sistema MADM Comissionamento (Atualizado com 2FA, Calculator e Controle de Acesso)
import { Calculator } from './calculator.js';
import { ExtractBD } from './services/extractBD.js';
import { PostgresService } from './Postgree-Service.js';
import { StartServer } from './start-server.js';
import twoFactorService from './security/verif-2factory.js';
import { accessControl } from './services/access-control.js';

dotenv.config();

// Instâncias dos serviços
const calculator = new Calculator();
const extractBD = new ExtractBD();
const postgresService = new PostgresService();
const startServer = new StartServer();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3008;

// Estado global da aplicação
let currentUser = null;
let selectedDate = new Date().toISOString().split('T')[0];
let twoFactorTimer = null;
let currentConfig = null; // Armazenar configurações do usuário
let isAuthenticated = false; // Flag de autenticação

// Elementos DOM
const elements = {
    // Login
    loginPanel: document.getElementById('loginPanel'),
    twoFactorVerifyPanel: document.getElementById('twoFactorVerifyPanel'),
    overlay: document.getElementById('overlay'),
    
    // User info
    userInfoNome: document.getElementById('userInfoNome'),
    userInfoEquipe: document.getElementById('userInfoEquipe'),
    userInfoGrupo: document.getElementById('userInfoGrupo'),
    userAccessLevel: document.getElementById('userAccessLevel'),
    
    // Indicators
    metaValue: document.getElementById('metaValue'),
    bonusValue: document.getElementById('bonusValue'),
    comissaoValue: document.getElementById('comissaoValue'),
    metaProgress: document.getElementById('metaProgress'),
    metaPercent: document.getElementById('metaPercent'),
    QTDAtMeta: document.getElementById('QTD-At-meta'),
    
    // Metrics
    emitidosValue: document.getElementById('emitidosValue'),
    assinadosValue: document.getElementById('assinadosValue'),
    ganhosValue: document.getElementById('ganhosValue'),
    perdidosValue: document.getElementById('perdidosValue'),
    
    // Date filter
    consultaDataMeta: document.getElementById('consultaDataMeta'),
    aplicarDataMetaBtn: document.getElementById('aplicarDataMetaBtn'),
    
    // Buttons
    logoutBtn: document.getElementById('logoutBtn'),
    closeLoginBtn: document.getElementById('closeLoginBtn'),
    closeVerifyBtn: document.getElementById('closeVerifyBtn'),
    verifyTwoFactorBtn: document.getElementById('verifyTwoFactorBtn'),
    cancelTwoFactorBtn: document.getElementById('cancelTwoFactorBtn'),
    resendCodeBtn: document.getElementById('resendCodeBtn'),
    
    // Team page elements
    tabelaColaboradoresBody: document.getElementById('tabelaColaboradoresBody'),
    totalColaboradores: document.getElementById('totalColaboradores'),
    totalComissoes: document.getElementById('totalComissoes'),
    exportarBtn: document.getElementById('exportarBtn'),
    atualizarBtn: document.getElementById('atualizarBtn'),
    linkEquipes: document.getElementById('linkEquipes'),
    linkIndex: document.getElementById('link-index'),
    
    // Main content
    mainContent: document.querySelector('main'),
    dashboardContainer: document.querySelector('.dashboard-container'),
    headerContent: document.querySelector('header')
};

// ==================== ROTAS DA API ====================

// (Opcional) Rota de teste para verificar se o servidor está online
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== INICIALIZAÇÃO ====================

// Instância do PostgresService (se precisar ser usada em outras rotas)
const dbService = new PostgresService();

// Conectar ao banco antes de iniciar o servidor
async function startServer() {
  try {
    await dbService.connect(); // supondo que exista um método connect()
    console.log('✅ Conectado ao PostgreSQL');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`   Endpoints de recuperação de senha disponíveis em /api/request-reset e /api/verify-code`);
    });
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    process.exit(1);
  }
}

startServer();

// Exportar para uso em outros lugares (se necessário)
export { app, dbService };

// ==================== FUNÇÕES DE UTILITÁRIO ====================

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(date) {
    return date.toLocaleDateString('pt-BR');
}

function parseDate(dateString) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    return null;
}

function showOverlay(show) {
    if (elements.overlay) {
        elements.overlay.style.display = show ? 'block' : 'none';
    }
}

function showPanel(panel, show) {
    if (panel) {
        panel.style.display = show ? 'block' : 'none';
        showOverlay(show);
    }
}

// Ocultar/Mostrar conteúdo principal baseado na autenticação
function toggleMainContent(show) {
    if (elements.mainContent) {
        elements.mainContent.style.display = show ? 'block' : 'none';
    }
    if (elements.headerContent) {
        elements.headerContent.style.display = show ? 'flex' : 'none';
    }
}

// ==================== FUNÇÕES DE CONFIGURAÇÃO ====================

async function loadUserConfigurations(userId) {
    try {
        // Carregar configurações do usuário do banco de dados
        const userConfig = await postgresService.getUserConfigurations(userId);
        
        if (userConfig) {
            // Atualizar configurações do calculator
            calculator.updateConfig({
                pesoGanhos: userConfig.peso_ganhos || 3,
                pesoAssinados: userConfig.peso_assinados || 3,
                bonusBase: userConfig.bonus_base || 10.00,
                comissaoPercentualPadrao: userConfig.comissao_percentual_padrao || 5,
                bonusExtraPorMeta: userConfig.bonus_extra_por_meta || 50.00
            });
            
            currentConfig = calculator.getConfig();
        } else {
            // Usar configurações padrão
            console.log('Usando configurações padrão do calculator');
            currentConfig = calculator.getConfig();
        }
        
        return currentConfig;
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        currentConfig = calculator.getConfig();
        return currentConfig;
    }
}

// Aplicar restrições de UI baseadas no nível de acesso
function applyAccessRestrictions() {
    if (!currentUser) return;
    
    const uiConfig = accessControl.getUIConfig(currentUser);
    
    // Aplicar restrições de visibilidade dos elementos da UI
    if (elements.linkEquipes) {
        if (!uiConfig.showTeamPage) {
            elements.linkEquipes.style.display = 'none';
        } else {
            elements.linkEquipes.style.display = 'inline-block';
        }
    }
    
    if (elements.exportarBtn) {
        elements.exportarBtn.style.display = uiConfig.showExportButton ? 'inline-block' : 'none';
    }
    
    // Mostrar nível de acesso na interface
    if (elements.userAccessLevel) {
        elements.userAccessLevel.textContent = uiConfig.accessLevel;
        elements.userAccessLevel.title = `Grupo: ${uiConfig.group}`;
    }
    
    if (elements.userInfoGrupo) {
        elements.userInfoGrupo.textContent = currentUser.grupo || 'N/A';
    }
    
    // Log de acesso para auditoria
    console.log('Restrições de acesso aplicadas:', uiConfig);
    
    // Gerar relatório de auditoria se necessário
    if (uiConfig.accessLevel === 'ADMINISTRATIVO') {
        const auditReport = accessControl.generateAuditReport(currentUser);
        console.log('Relatório de acesso:', auditReport);
    }
}

// ==================== FUNÇÕES DE AUTENTICAÇÃO ====================

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Limpar status anterior
    const statusDiv = document.getElementById('loginStatus');
    if (statusDiv) {
        statusDiv.textContent = '';
        statusDiv.className = 'login-status';
    }
    
    try {
        const user = await postgresService.authenticateUser(username, password);
        
        if (user) {
            // Verificar nível de acesso do usuário
            const accessLevel = accessControl.getAccessLevel(user.grupo);
            
            // Se o usuário for DESCONSIDERAR, não permitir login
            if (accessLevel === 0) {
                showLoginStatus('Acesso negado. Usuário sem permissão.', 'error');
                return;
            }
            
            currentUser = user;
            
            // Carregar configurações do usuário
            await loadUserConfigurations(user.id);
            
            // Buscar email do usuário
            const userEmail = await postgresService.getUserEmail(user.id);
            
            if (!userEmail) {
                showLoginStatus('Email não encontrado para este usuário', 'error');
                return;
            }
            
            // Enviar código 2FA
            const result = await twoFactorService.sendCode(userEmail, user.nome || user.username);
            
            if (result.success) {
                showPanel(elements.loginPanel, false);
                showPanel(elements.twoFactorVerifyPanel, true);
                
                // Iniciar timer de expiração
                startTwoFactorTimer();
                
                // Limpar campo de código
                document.getElementById('twoFactorCode').value = '';
            } else {
                showLoginStatus(result.error || 'Erro ao enviar código de verificação', 'error');
            }
        } else {
            showLoginStatus('Usuário ou senha inválidos', 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showLoginStatus('Erro ao realizar login', 'error');
    }
}

function showLoginStatus(message, type) {
    const statusDiv = document.getElementById('loginStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `login-status ${type}`;
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'login-status';
        }, 3000);
    }
}

function startTwoFactorTimer() {
    if (twoFactorTimer) clearInterval(twoFactorTimer);
    
    let timeLeft = 300;
    const timerElement = document.createElement('div');
    timerElement.id = 'twoFactorTimer';
    timerElement.className = 'timer-countdown';
    
    const verifyPanel = document.querySelector('.twofactor-content');
    if (verifyPanel) {
        const existingTimer = document.getElementById('twoFactorTimer');
        if (existingTimer) existingTimer.remove();
        verifyPanel.appendChild(timerElement);
    }
    
    twoFactorTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `Código expira em: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(twoFactorTimer);
            timerElement.textContent = 'Código expirado. Solicite um novo.';
            timerElement.style.color = 'red';
        }
        timeLeft--;
    }, 1000);
}

async function verifyTwoFactor() {
    const enteredCode = document.getElementById('twoFactorCode').value;
    const userId = currentUser?.nome || currentUser?.username;
    
    if (!userId) {
        alert('Erro: usuário não identificado');
        return;
    }
    
    // Verificar código usando o serviço 2FA
    const verification = twoFactorService.verifyCode(userId, enteredCode);
    
    if (verification.success) {
        clearInterval(twoFactorTimer);
        twoFactorService.stopTimer();
        showPanel(elements.twoFactorVerifyPanel, false);
        
        // Marcar como autenticado
        isAuthenticated = true;
        
        // Mostrar conteúdo principal
        toggleMainContent(true);
        
        // Carregar dashboard do usuário
        await loadUserDashboard();
        
        // Aplicar restrições de acesso
        applyAccessRestrictions();
        
        // Inicializar servidor após login bem-sucedido
        startServer.initialize();
        
        // Verificar página atual e aplicar restrições
        checkPageAccess();
    } else {
        alert(verification.error);
        
        // Se muitas tentativas, fechar painel e voltar ao login
        if (verification.error.includes('Muitas tentativas')) {
            cancelTwoFactor();
        }
    }
}

async function resendTwoFactorCode() {
    const userId = currentUser?.nome || currentUser?.username;
    const userEmail = await postgresService.getUserEmail(currentUser?.id);
    
    if (userId && userEmail) {
        const result = await twoFactorService.resendCode(userId, userEmail);
        
        if (result.success) {
            alert('Novo código enviado para seu email');
            
            // Reiniciar timer
            clearInterval(twoFactorTimer);
            startTwoFactorTimer();
        } else {
            alert(result.error || 'Erro ao reenviar código');
        }
    } else {
        alert('Erro: usuário não identificado');
    }
}

function cancelTwoFactor() {
    clearInterval(twoFactorTimer);
    twoFactorService.stopTimer();
    
    // Limpar código do usuário atual
    if (currentUser) {
        const userId = currentUser.nome || currentUser.username;
        twoFactorService.clearCode(userId);
    }
    
    showPanel(elements.twoFactorVerifyPanel, false);
    showPanel(elements.loginPanel, true);
    currentUser = null;
    isAuthenticated = false;
    toggleMainContent(false);
}

// ==================== CONTROLE DE ACESSO ÀS PÁGINAS ====================

function checkPageAccess() {
    if (!isAuthenticated || !currentUser) {
        // Se não estiver autenticado, redirecionar para login
        if (window.location.pathname.includes('equipes.html')) {
            window.location.href = '../index.html';
        }
        return;
    }
    
    const currentPath = window.location.pathname;
    const userLevel = accessControl.getAccessLevel(currentUser.grupo);
    
    // Verificar acesso à página de equipes
    if (currentPath.includes('equipes.html')) {
        // Assessor não pode acessar página de equipes
        if (userLevel === 1) { // LEVELS.ASSESSOR = 1
            showAccessDeniedMessage('Acesso Negado', 'Usuários do tipo ASSESSOR não têm permissão para acessar a página de equipes.');
            
            // Redirecionar após 3 segundos
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 3000);
            return;
        }
        
        // Verificar se tem permissão para ver equipe
        const permissions = accessControl.getUserPermissions(currentUser);
        if (!permissions.canViewTeam) {
            showAccessDeniedMessage('Acesso Negado', 'Você não tem permissão para visualizar dados da equipe.');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 3000);
            return;
        }
        
        // Carregar dados da equipe se tiver permissão
        loadTeamMembers();
    }
}

function showAccessDeniedMessage(title, message) {
    // Criar modal de acesso negado
    const modal = document.createElement('div');
    modal.className = 'access-denied-modal';
    modal.innerHTML = `
        <div class="access-denied-content">
            <div class="access-denied-header">
                <span class="access-denied-icon">🚫</span>
                <h2>${title}</h2>
            </div>
            <div class="access-denied-body">
                <p>${message}</p>
                <p>Redirecionando para o dashboard em alguns segundos...</p>
            </div>
            <div class="access-denied-footer">
                <button onclick="window.location.href='../index.html'" class="btn-primary">Voltar ao Dashboard</button>
            </div>
        </div>
    `;
    
    // Adicionar estilos
    const style = document.createElement('style');
    style.textContent = `
        .access-denied-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .access-denied-content {
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        }
        .access-denied-header {
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 12px 12px 0 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .access-denied-icon {
            font-size: 32px;
        }
        .access-denied-body {
            padding: 20px;
            color: #333;
        }
        .access-denied-footer {
            padding: 20px;
            border-top: 1px solid #eee;
            text-align: center;
        }
        @keyframes slideIn {
            from {
                transform: translateY(-50px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Remover modal após 5 segundos ou quando clicar no botão
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.remove();
        }
    }, 5000);
}

// ==================== FUNÇÕES DO DASHBOARD ====================

async function loadUserDashboard() {
    if (!currentUser || !isAuthenticated) return;
    
    try {
        // Carregar dados do usuário
        const userData = await postgresService.getUserData(currentUser.id, selectedDate);
        
        // Atualizar informações do usuário
        if (elements.userInfoNome) elements.userInfoNome.textContent = currentUser.nome;
        if (elements.userInfoEquipe) elements.userInfoEquipe.textContent = currentUser.equipe;
        
        // Atualizar métricas principais
        if (elements.emitidosValue) elements.emitidosValue.textContent = userData.emitidos || 0;
        if (elements.assinadosValue) elements.assinadosValue.textContent = userData.assinados || 0;
        if (elements.ganhosValue) elements.ganhosValue.textContent = userData.ganhos || 0;
        if (elements.perdidosValue) elements.perdidosValue.textContent = userData.perdidos || 0;
        
        // Carregar meta do usuário
        const metaConfig = await postgresService.getUserMeta(currentUser.id);
        const metaQuantidade = metaConfig?.meta_quantidade || 10;
        const metaPercentual = metaConfig?.meta_percentual || 70;
        
        const ganhos = userData.ganhos || 0;
        const assinados = userData.assinados || 0;
        
        // Usar Calculator para verificar meta (com sistema de pesos)
        const bateuMeta = calculator.checkGoal(ganhos, assinados, metaQuantidade, metaPercentual);
        const metasBatidas = bateuMeta ? 1 : 0;
        
        // Atualizar display de meta
        if (elements.metaValue) elements.metaValue.textContent = metasBatidas;
        
        // Calcular e atualizar progresso usando Calculator
        const progressPercent = calculator.calculateProgress(ganhos, metaQuantidade);
        if (elements.metaProgress) elements.metaProgress.style.width = `${Math.min(100, progressPercent)}%`;
        if (elements.metaPercent) elements.metaPercent.textContent = `${Math.round(progressPercent)}%`;
        
        // Calcular quantidade faltante usando Calculator
        const qtdParaMeta = calculator.calculateRemainingToGoal(ganhos, metaQuantidade);
        if (elements.QTDAtMeta) elements.QTDAtMeta.textContent = Math.max(0, qtdParaMeta);
        
        // Calcular comissão usando Calculator
        const comissaoPercentual = userData.comissao_percentual || currentConfig?.comissaoPercentualPadrao || 5;
        const comissao = calculator.calculateCommission(assinados, comissaoPercentual);
        
        // Calcular bônus usando Calculator (agora com sistema de pesos)
        const bonus = calculator.calculateBonus(metasBatidas, ganhos, metaQuantidade);
        
        // Atualizar valores na tela
        if (elements.comissaoValue) elements.comissaoValue.textContent = formatCurrency(comissao);
        if (elements.bonusValue) elements.bonusValue.textContent = formatCurrency(bonus);
        
        // Calcular e exibir pontuação total (opcional)
        const totalScore = calculator.calculateTotalScore(ganhos, assinados);
        const successRate = calculator.calculateSuccessRate(ganhos, assinados);
        
        // Adicionar informações extras ao dashboard (opcional)
        updateExtraMetrics(totalScore, successRate, bateuMeta);
        
        // Extrair dados para relatório
        await extractBD.extractUserData(currentUser.id, selectedDate);
        
        // Log para debug
        console.log(`Dashboard atualizado - Meta: ${metaQuantidade}, Ganhos: ${ganhos}, Assinados: ${assinados}, Bateu Meta: ${bateuMeta}, Bônus: ${bonus}`);
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        alert('Erro ao carregar dados do dashboard. Tente novamente.');
    }
}

// Função auxiliar para atualizar métricas extras no dashboard
function updateExtraMetrics(totalScore, successRate, bateuMeta) {
    // Verificar se os elementos existem, se não, criar dinamicamente
    let scoreElement = document.getElementById('totalScore');
    let rateElement = document.getElementById('successRate');
    let metaStatusElement = document.getElementById('metaStatus');
    
    if (!scoreElement) {
        // Criar elementos se não existirem
        const metricsSection = document.querySelector('.metrics-cards');
        if (metricsSection) {
            const scoreCard = document.createElement('div');
            scoreCard.className = 'card';
            scoreCard.innerHTML = `<h3>Pontuação Total</h3><div class="card-value" id="totalScore">${totalScore}</div>`;
            metricsSection.appendChild(scoreCard);
            
            const rateCard = document.createElement('div');
            rateCard.className = 'card';
            rateCard.innerHTML = `<h3>Aproveitamento</h3><div class="card-value" id="successRate">${Math.round(successRate)}%</div>`;
            metricsSection.appendChild(rateCard);
        }
    } else {
        if (scoreElement) scoreElement.textContent = totalScore;
        if (rateElement) rateElement.textContent = `${Math.round(successRate)}%`;
    }
    
    // Atualizar status da meta nos indicadores
    const metaCard = document.querySelector('.indicator-card:first-child');
    if (metaCard && !metaStatusElement) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'metaStatus';
        statusDiv.className = 'meta-status';
        statusDiv.style.marginTop = '10px';
        statusDiv.style.fontWeight = 'bold';
        metaCard.appendChild(statusDiv);
        metaStatusElement = statusDiv;
    }
    
    if (metaStatusElement) {
        metaStatusElement.textContent = bateuMeta ? '✅ Meta BATIDA!' : '⏳ Em progresso...';
        metaStatusElement.style.color = bateuMeta ? 'green' : 'orange';
    }
}

// ==================== FUNÇÕES DA PÁGINA DE EQUIPE ====================

async function loadTeamMembers() {
    if (!currentUser || !isAuthenticated) return;
    
    // Verificar permissão antes de carregar
    const permissions = accessControl.getUserPermissions(currentUser);
    if (!permissions.canViewTeam) {
        console.warn('Usuário sem permissão para ver equipe');
        return;
    }
    
    try {
        const teamMembers = await postgresService.getTeamMembers(currentUser.equipe);
        
        // Filtrar dados baseado no nível de acesso
        const filteredMembers = accessControl.filterTeamData(teamMembers, currentUser);
        
        if (elements.tabelaColaboradoresBody) {
            // Usar Calculator para calcular ranking da equipe
            const rankedMembers = calculator.calculateRanking(filteredMembers);
            renderTeamTable(rankedMembers);
            
            // Calcular bônus da equipe
            const teamBonus = calculator.calculateTeamBonus(filteredMembers);
            displayTeamBonus(teamBonus);
        }
    } catch (error) {
        console.error('Erro ao carregar equipe:', error);
    }
}

function renderTeamTable(members) {
    if (!elements.tabelaColaboradoresBody) return;
    
    const tbody = elements.tabelaColaboradoresBody;
    tbody.innerHTML = '';
    
    let totalComissao = 0;
    let totalBonus = 0;
    
    members.forEach(member => {
        const row = tbody.insertRow();
        
        // Adicionar ranking
        const rankCell = row.insertCell(0);
        rankCell.textContent = `#${member.ranking}`;
        rankCell.className = 'ranking-cell';
        
        row.insertCell(1).textContent = member.id;
        row.insertCell(2).textContent = member.nome;
        row.insertCell(3).textContent = member.equipe;
        row.insertCell(4).textContent = member.cargo;
        row.insertCell(5).textContent = member.status;
        row.insertCell(6).textContent = member.meta_individual || 0;
        
        // Usar valores já calculados pelo ranking
        const comissao = member.comissao;
        const bonus = member.bonus;
        
        row.insertCell(7).textContent = formatCurrency(comissao);
        row.insertCell(8).textContent = formatCurrency(bonus);
        totalComissao += comissao;
        totalBonus += bonus;
        
        // Status da meta
        const statusCell = row.insertCell(9);
        statusCell.textContent = member.bateuMeta ? '✅' : '⏳';
        statusCell.className = member.bateuMeta ? 'meta-achieved' : 'meta-progress';
        
        row.insertCell(10).textContent = member.ultima_atualizacao ? 
            formatDate(new Date(member.ultima_atualizacao)) : '-';
        
        // Pontuação
        row.insertCell(11).textContent = member.score;
        
        // Verificar permissão para ver detalhes do usuário
        const permissions = accessControl.getUserPermissions(currentUser);
        if (permissions.canViewTeam) {
            const actionsCell = row.insertCell(12);
            const viewBtn = document.createElement('button');
            viewBtn.textContent = 'Visualizar';
            viewBtn.className = 'btn-view';
            viewBtn.onclick = () => viewUserDetails(member.id);
            actionsCell.appendChild(viewBtn);
        }
    });
    
    if (elements.totalColaboradores) {
        elements.totalColaboradores.textContent = members.length;
    }
    
    if (elements.totalComissoes) {
        elements.totalComissoes.textContent = formatCurrency(totalComissao);
    }
    
    // Adicionar total de bônus se existir elemento
    let totalBonusElement = document.getElementById('totalBonus');
    if (!totalBonusElement) {
        const statsContainer = document.querySelector('.team-stats');
        if (statsContainer) {
            const bonusDiv = document.createElement('div');
            bonusDiv.className = 'stat-item';
            bonusDiv.innerHTML = `<strong>Total Bônus:</strong> <span id="totalBonus">${formatCurrency(totalBonus)}</span>`;
            statsContainer.appendChild(bonusDiv);
            totalBonusElement = document.getElementById('totalBonus');
        }
    } else {
        totalBonusElement.textContent = formatCurrency(totalBonus);
    }
}

function displayTeamBonus(teamBonus) {
    let teamBonusElement = document.getElementById('teamBonusInfo');
    if (!teamBonusElement) {
        const container = document.querySelector('.indicators-grid');
        if (container) {
            const bonusCard = document.createElement('div');
            bonusCard.className = 'indicator-card';
            bonusCard.id = 'teamBonusInfo';
            bonusCard.innerHTML = `
                <h4>Bônus da Equipe</h4>
                <div class="indicator-value">${formatCurrency(teamBonus.totalBonus)}</div>
                <small>${teamBonus.members.filter(m => m.bateuMeta).length} membros bateram meta</small>
            `;
            container.appendChild(bonusCard);
            teamBonusElement = bonusCard;
        }
    } else {
        teamBonusElement.querySelector('.indicator-value').textContent = formatCurrency(teamBonus.totalBonus);
        const metaCount = teamBonus.members.filter(m => m.bateuMeta).length;
        teamBonusElement.querySelector('small').textContent = `${metaCount} membros bateram meta`;
    }
}

async function viewUserDetails(userId) {
    // Verificar permissão
    if (!accessControl.canViewUser(currentUser, { id: userId })) {
        alert('Você não tem permissão para visualizar dados deste usuário.');
        return;
    }
    
    const userData = await postgresService.getUserData(userId, selectedDate);
    const metaConfig = await postgresService.getUserMeta(userId);
    
    const ganhos = userData.ganhos || 0;
    const assinados = userData.assinados || 0;
    const metaQuantidade = metaConfig?.meta_quantidade || 10;
    
    // Calcular projeção usando Calculator
    const diasRestantes = 30 - new Date(selectedDate).getDate();
    const projection = calculator.calculateProjection(ganhos, assinados, diasRestantes, metaQuantidade);
    
    alert(`Detalhes do colaborador:
    
📊 Métricas:
• Emitidos: ${userData.emitidos || 0}
• Assinados: ${userData.assinados || 0}
• Ganhos: ${userData.ganhos || 0}
• Perdidos: ${userData.perdidos || 0}

🎯 Meta:
• Quantidade: ${metaQuantidade}
• Percentual: ${metaConfig?.meta_percentual || 70}%

📈 Projeção (${diasRestantes} dias restantes):
• Ganhos Projetados: ${projection.ganhosProjetados}
• Assinados Projetados: ${projection.assinadosProjetados}
• Necessário por dia: ${projection.ganhosNecessariosPorDia} ganhos/dia
• Meta Projetada: ${projection.projecaoMeta ? '✅ SIM' : '❌ NÃO'}

💰 Financeiro:
• Comissão: ${formatCurrency(calculator.calculateCommission(assinados, userData.comissao_percentual || 5))}
• Bônus: ${formatCurrency(calculator.calculateBonus(calculator.checkGoal(ganhos, assinados, metaQuantidade) ? 1 : 0, ganhos, metaQuantidade))}`);
}

async function exportTeamData() {
    // Verificar permissão
    const permissions = accessControl.getUserPermissions(currentUser);
    if (!permissions.canExportData) {
        alert('Você não tem permissão para exportar dados.');
        return;
    }
    
    const members = await postgresService.getTeamMembers(currentUser.equipe);
    const filteredMembers = accessControl.filterTeamData(members, currentUser);
    const rankedMembers = calculator.calculateRanking(filteredMembers);
    const csv = convertToCSV(rankedMembers);
    downloadCSV(csv, `equipe_${currentUser.equipe}_${selectedDate}.csv`);
}

function convertToCSV(data) {
    const headers = ['Ranking', 'ID', 'Nome', 'Equipe', 'Cargo', 'Status', 'Meta Individual', 'Comissão', 'Bônus', 'Bateu Meta', 'Pontuação', 'Última Atualização'];
    const rows = data.map(item => [
        item.ranking,
        item.id,
        item.nome,
        item.equipe,
        item.cargo,
        item.status,
        item.meta_individual,
        calculator.calculateCommission(item.assinados || 0, item.comissao_percentual || 5),
        calculator.calculateBonus(item.bateuMeta ? 1 : 0, item.ganhos || 0, item.meta_individual || 10),
        item.bateuMeta ? 'Sim' : 'Não',
        calculator.calculateTotalScore(item.ganhos || 0, item.assinados || 0),
        item.ultima_atualizacao
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ==================== FUNÇÕES DE DATA ====================

function applyDateFilter() {
    if (!currentUser || !isAuthenticated) return;
    
    const dateInput = elements.consultaDataMeta?.value;
    if (dateInput) {
        const parsedDate = parseDate(dateInput);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
            selectedDate = parsedDate.toISOString().split('T')[0];
            loadUserDashboard();
            
            if (window.location.pathname.includes('equipes.html')) {
                const permissions = accessControl.getUserPermissions(currentUser);
                if (permissions.canViewTeam) {
                    loadTeamMembers();
                }
            }
        } else {
            alert('Data inválida. Use o formato DD/MM/AAAA');
        }
    }
}

// ==================== FUNÇÕES DE CONFIGURAÇÃO DO CALCULATOR ====================

async function updateCalculatorConfig(newConfig) {
    if (!currentUser || !isAuthenticated) return false;
    
    // Verificar permissão
    const permissions = accessControl.getUserPermissions(currentUser);
    if (!permissions.canAdjustGoal) {
        alert('Você não tem permissão para ajustar configurações.');
        return false;
    }
    
    try {
        // Atualizar no calculator
        calculator.updateConfig(newConfig);
        
        // Salvar no banco de dados
        if (currentUser) {
            await postgresService.saveUserConfigurations(currentUser.id, newConfig);
        }
        
        // Recarregar dashboard com novas configurações
        await loadUserDashboard();
        
        console.log('Configurações do calculator atualizadas:', calculator.getConfig());
        return true;
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        return false;
    }
}

// ==================== FUNÇÕES DE LOGOUT ====================

function logout() {
    // Limpar dados de autenticação
    if (currentUser) {
        const userId = currentUser.nome || currentUser.username;
        twoFactorService.clearCode(userId);
        twoFactorService.stopTimer();
    }
    
    currentUser = null;
    selectedDate = new Date().toISOString().split('T')[0];
    currentConfig = null;
    isAuthenticated = false;
    
    if (twoFactorTimer) clearInterval(twoFactorTimer);
    
    // Resetar calculator para configurações padrão
    calculator.updateConfig({
        pesoGanhos: 3,
        pesoAssinados: 3,
        bonusBase: 10.00,
        comissaoPercentualPadrao: 5,
        bonusExtraPorMeta: 50.00
    });
    
    // Ocultar conteúdo principal
    toggleMainContent(false);
    
    // Mostrar painel de login
    showPanel(elements.loginPanel, true);
    showPanel(elements.twoFactorVerifyPanel, false);
    
    // Limpar formulário de login
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const codeInput = document.getElementById('twoFactorCode');
    
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (codeInput) codeInput.value = '';
    
    // Redirecionar para página inicial se estiver em equipes
    if (window.location.pathname.includes('equipes.html')) {
        window.location.href = '../index.html';
    }
}

// ==================== NAVEGAÇÃO ====================

function navigateToTeamPage(e) {
    if (e) e.preventDefault();
    
    if (!currentUser || !isAuthenticated) {
        alert('Faça login primeiro');
        return;
    }
    
    // Verificar permissão para acessar página de equipes
    const userLevel = accessControl.getAccessLevel(currentUser.grupo);
    
    if (userLevel === 1) { // ASSESSOR
        alert('Acesso Negado: Usuários do tipo ASSESSOR não têm permissão para acessar a página de equipes.');
        return;
    }
    
    const permissions = accessControl.getUserPermissions(currentUser);
    if (!permissions.canViewTeam) {
        alert('Você não tem permissão para visualizar dados da equipe.');
        return;
    }
    
    window.location.href = 'pages/equipes.html';
}

function navigateToIndex(e) {
    if (e) e.preventDefault();
    
    if (!currentUser || !isAuthenticated) {
        alert('Faça login primeiro');
        return;
    }
    
    window.location.href = '../index.html';
}

// ==================== INICIALIZAÇÃO ====================

function initializeEventListeners() {
    // Login events
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    if (elements.closeLoginBtn) elements.closeLoginBtn.addEventListener('click', () => showPanel(elements.loginPanel, false));
    if (elements.closeVerifyBtn) elements.closeVerifyBtn.addEventListener('click', () => cancelTwoFactor());
    if (elements.verifyTwoFactorBtn) elements.verifyTwoFactorBtn.addEventListener('click', verifyTwoFactor);
    if (elements.cancelTwoFactorBtn) elements.cancelTwoFactorBtn.addEventListener('click', cancelTwoFactor);
    if (elements.resendCodeBtn) elements.resendCodeBtn.addEventListener('click', resendTwoFactorCode);
    
    // Dashboard events
    if (elements.aplicarDataMetaBtn) elements.aplicarDataMetaBtn.addEventListener('click', applyDateFilter);
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', logout);
    
    // Team page events
    if (elements.exportarBtn) elements.exportarBtn.addEventListener('click', exportTeamData);
    if (elements.atualizarBtn) elements.atualizarBtn.addEventListener('click', loadTeamMembers);
    
    // Navigation
    if (elements.linkEquipes) elements.linkEquipes.addEventListener('click', navigateToTeamPage);
    if (elements.linkIndex) elements.linkIndex.addEventListener('click', navigateToIndex);
    
    // Input mask for date
    if (elements.consultaDataMeta) {
        elements.consultaDataMeta.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 3) value = value.slice(0, 2) + '/' + value.slice(2);
            if (value.length >= 6) value = value.slice(0, 5) + '/' + value.slice(5, 9);
            e.target.value = value;
        });
    }
}

function initializePage() {
    // Ocultar conteúdo principal inicialmente
    toggleMainContent(false);
    
    initializeEventListeners();
    
    // Configurar URL base da API para o serviço 2FA
    if (twoFactorService.setApiBaseUrl) {
        twoFactorService.setApiBaseUrl(window.location.origin);
    }
    
    // Mostrar apenas o painel de login
    showPanel(elements.loginPanel, true);
    showPanel(elements.twoFactorVerifyPanel, false);
    
    // Log das configurações iniciais do calculator
    console.log('Calculator inicializado com configurações:', calculator.getConfig());
    console.log('Sistema de controle de acesso inicializado');
}

// Verificar autenticação ao carregar a página (para páginas que não sejam a inicial)
function checkInitialAuth() {
    // Se não for a página de login e não estiver autenticado, redirecionar
    if (!isAuthenticated && !window.location.pathname.includes('index.html')) {
        window.location.href = '../index.html';
    }
}

// Inicializar aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    checkInitialAuth();
    checkPageAccess();
});

// Exportar funções para uso em outros módulos
export {
    handleLogin,
    logout,
    loadUserDashboard,
    loadTeamMembers,
    applyDateFilter,
    formatCurrency,
    updateCalculatorConfig,
    calculator,
    accessControl
};