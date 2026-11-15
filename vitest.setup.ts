// Os testes da interface foram escritos com os textos em português: fixa o idioma antes de cada arquivo.
try {
  globalThis.localStorage?.setItem('mo_lang', 'pt');
} catch {
  /* ambiente sem localStorage (node): o jogo cai no padrão */
}
