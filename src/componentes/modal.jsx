/*
  O <Modal> mudou para src/ui/modal.jsx (o design system). Este caminho só
  reexporta, para os componentes que ainda importam daqui (e para os ramos
  abertos em paralelo); quem mexer num deles importa de "../../ui/index.js".
  Sai quando ninguém mais importar daqui.
*/
export { Modal } from "../ui/modal.jsx";
