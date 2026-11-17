export function assistantName(language, config) {
  return language === 'my' ? (config?.name_my || 'ဝိုင်းဝိုင်း') : (config?.name || 'Wyne Wyne');
}
