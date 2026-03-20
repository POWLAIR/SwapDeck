import { api } from './api.js';

const PREDEFINED_USERS = [
  { handle: 'axel_d',   name: 'Axel D.',    avatar: '🔥', specialty: 'Pokémon' },
  { handle: 'mira_k',   name: 'Mira K.',    avatar: '✨', specialty: 'Magic: The Gathering' },
  { handle: 'soren_l',  name: 'Soren L.',   avatar: '⚡', specialty: 'Yu-Gi-Oh!' },
  { handle: 'camille_t',name: 'Camille T.', avatar: '🌙', specialty: 'Tous genres' },
];

export function renderAuthScreen(onLogin) {
  const overlay = document.getElementById('auth-overlay');
  const picker  = document.getElementById('user-picker');

  overlay.classList.remove('hidden');

  picker.innerHTML = PREDEFINED_USERS.map((u) => `
    <button class="user-btn" data-handle="${u.handle}">
      <span class="user-avatar">${u.avatar}</span>
      <span>${u.name}</span>
      <span class="user-specialty">${u.specialty}</span>
    </button>
  `).join('');

  picker.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-handle]');
    if (!btn) return;

    try {
      const { user } = await api.login(btn.dataset.handle);
      overlay.classList.add('hidden');
      onLogin(user);
    } catch (err) {
      alert('Connexion échouée : ' + err.message);
    }
  });
}

export function renderCurrentUser(user) {
  const el = document.getElementById('current-user');
  el.innerHTML = `
    <span style="font-size:1.2rem">${user.avatar || '👤'}</span>
    <strong>${user.name}</strong>
  `;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.gap = '0.4rem';
}
