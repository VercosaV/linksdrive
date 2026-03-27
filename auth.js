import { showToast } from "./ui.js";

const SALT_KEY = "dashboard_salt";
const HASH_KEY = "dashboard_hash";
const AUTH_KEY = "dashboard_auth";
const DEFAULT_PASSWORD = "admin123";

// Gera um salt aleatório (16 bytes) em base64
async function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...salt));
}

// Deriva um hash a partir da senha e salt usando PBKDF2
async function hashPassword(password, saltBase64) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    256 // 32 bytes
  );
  const hashArray = new Uint8Array(derivedBits);
  return btoa(String.fromCharCode(...hashArray));
}

// Verifica se a senha informada corresponde ao hash armazenado
export async function verifyPassword(password) {
  const salt = localStorage.getItem(SALT_KEY);
  const storedHash = localStorage.getItem(HASH_KEY);
  if (!salt || !storedHash) {
    // Nenhum hash armazenado (primeiro uso) – criamos com a senha padrão
    await setPassword(DEFAULT_PASSWORD);
    return await verifyPassword(password);
  }
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}

// Altera a senha (gera novo salt e novo hash)
export async function setPassword(newPassword) {
  const newSalt = await generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  localStorage.setItem(SALT_KEY, newSalt);
  localStorage.setItem(HASH_KEY, newHash);
  // Mantém a autenticação ativa
  localStorage.setItem(AUTH_KEY, "true");
  showToast("Senha alterada com sucesso!", "success");
}

// Login: verifica senha e guarda flag de autenticação
export async function login(password) {
  const isValid = await verifyPassword(password);
  if (isValid) {
    localStorage.setItem(AUTH_KEY, "true");
    return true;
  }
  return false;
}

// Logout: remove flag de autenticação
export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

// Verifica se o usuário está autenticado (flag)
export function checkAuth() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

// Modal de alterar senha (controles)
export function openChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (!modal) return;
  modal.style.display = "flex";
  document.getElementById("currentPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmPassword").value = "";
  document.getElementById("currentPassword").focus();
}

export function closeChangePasswordModal() {
  const modal = document.getElementById("changePasswordModal");
  if (modal) modal.style.display = "none";
}

export async function saveNewPassword() {
  const current = document.getElementById("currentPassword").value;
  const newPwd = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (!current || !newPwd || !confirm) {
    showToast("Preencha todos os campos!", "error");
    return;
  }
  if (newPwd !== confirm) {
    showToast("As senhas não coincidem!", "error");
    return;
  }
  if (newPwd.length < 4) {
    showToast("A nova senha deve ter pelo menos 4 caracteres!", "error");
    return;
  }

  const isValidCurrent = await verifyPassword(current);
  if (!isValidCurrent) {
    showToast("Senha atual incorreta!", "error");
    return;
  }

  await setPassword(newPwd);
  closeChangePasswordModal();
}