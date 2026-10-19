export function answerGovernmentQuestion(message: string): string {
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
    return "Para preinscribirte a una feria local necesitás: DNI o CUIT, nombre del emprendimiento, rubro, descripción breve de los productos, teléfono de contacto y feria a la que querés postularte. FerIA genera la preinscripción y un certificado digital con código QR.";
  }

  if (text.includes("pago") || text.includes("arancel")) {
    return "Por el momento FerIA registra el estado de la inscripción. Los aranceles se coordinan directamente con el organizador de la feria.";
  }

  if (
    text.includes("certificado") ||
    text.includes("qr") ||
    text.includes("constancia")
  ) {
    return "El certificado se emite al completar la preinscripción. Queda registrado en el sistema y se puede verificar mediante su código QR.";
  }

  return "Soy FerIA, tu asistente para inscripción a ferias locales. Puedo ayudarte con requisitos, preinscripción, aranceles, certificados y consultas generales.";
}
