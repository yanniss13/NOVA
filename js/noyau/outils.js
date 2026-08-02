/* Trois utilitaires sans domaine, employes partout.

   Ils ne vont pas dans dom.js : ils ne touchent pas au DOM. Ils ne vont pas
   dans constantes.js : ce sont des fonctions. D'ou ce module. */

  const jsonCopy = value => JSON.parse(JSON.stringify(value));
  const owns = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
  const isInteger = value => Number.isInteger(value);

export {
  isInteger,
  jsonCopy,
  owns
};
