export function answerMunicipalityQuestion(message: string): string {
  const text = message.toLowerCase().trim();

  if (!text) {
    return "Escribime tu consulta sobre ferias, inscripción, requisitos, arancel o certificado.";
  }

  if (
    text.includes("requisito") ||
    text.includes("inscribir") ||
    text.includes("inscripción") ||
    text.includes("anotar")
  ) {
    return "Para preinscribirte a una feria local necesitás: DNI o CUIT, nombre del emprendimiento, rubro, descripción breve de los productos, teléfono de contacto y feria a la que querés postularte. FerIA puede generar una preinscripción y un certificado digital preparado para Arkiv.";
  }

  if (
    text.includes("pago") ||
    text.includes("arancel") ||
    text.includes("stellar") ||
    text.includes("xlm")
  ) {
    return "El pago del arancel queda preparado como segunda capa del proyecto. En el MVP principal registramos el estado de inscripción. Luego se puede integrar Stellar/Freighter para pagar un arancel simbólico en XLM testnet.";
  }

  if (
    text.includes("certificado") ||
    text.includes("qr") ||
    text.includes("constancia")
  ) {
    return "El certificado se emite al completar la preinscripción. En la versión final se guarda en Arkiv como entidad verificable y se muestra mediante QR o entityKey.";
  }

  if (
    text.includes("arkiv") ||
    text.includes("on-chain") ||
    text.includes("blockchain")
  ) {
    return "Arkiv funciona como capa de datos Web3. FerIA modela perfiles, inscripciones y certificados como entidades con payload, atributos consultables, expiración y trazabilidad.";
  }

  return "Soy FerIA, tu asistente para inscripción a ferias locales. Puedo ayudarte con requisitos, preinscripción, aranceles, certificados y datos preparados para Arkiv.";
}
