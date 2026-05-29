import { useState, type FormEvent } from "react";
import {
  backendRegisterAccount,
  type RegisterAccountRole,
} from "../services/backendApi";

export function RegisterAccountPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<RegisterAccountRole>("entrepreneur");
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [createdUsername, setCreatedUsername] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setCreatedUsername("");

    if (!fullName.trim()) {
      setMessage("Ingresa tu nombre completo.");
      return;
    }

    if (!document.trim()) {
      setMessage("Ingresa tu DNI / CUIT / identificador.");
      return;
    }

    if (!username.trim()) {
      setMessage("Ingresa un usuario.");
      return;
    }

    if (password.length < 8) {
      setMessage("La contrasena debe tener al menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await backendRegisterAccount({
        role,
        fullName: fullName.trim(),
        document: document.trim(),
        username: username.trim().toLowerCase(),
        password,
      });

      if (!result.ok) {
        setMessage(result.message ?? "No se pudo registrar la cuenta.");
        return;
      }

      setCreatedUsername(username.trim().toLowerCase());
      setMessage(
        "Cuenta registrada correctamente. Ahora podes iniciar sesion con tu usuario y contrasena."
      );

      setFullName("");
      setDocument("");
      setUsername("");
      setPassword("");
    } catch {
      setMessage("No se pudo conectar con el backend.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="register-account-panel">
      <button
        type="button"
        className="register-account-panel__toggle"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "Ocultar registro" : "Crear cuenta nueva"}
      </button>

      {isOpen && (
        <form className="register-account-panel__form" onSubmit={handleSubmit}>
          <div className="register-account-panel__header">
            <div>
              <p className="eyebrow">Registro publico</p>
              <h3>Crear cuenta</h3>
              <p>
                Registrate como emprendedor o feriante. La municipalidad se crea solo desde administracion.
              </p>
            </div>
          </div>

          <div className="register-role-grid">
            <button
              type="button"
              className={role === "entrepreneur" ? "active" : ""}
              onClick={() => setRole("entrepreneur")}
            >
              Emprendedor
            </button>

            <button
              type="button"
              className={role === "fair_organizer" ? "active" : ""}
              onClick={() => setRole("fair_organizer")}
            >
              Feriante
            </button>
          </div>

          <div className="register-form-grid">
            <label>
              Nombre completo
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ej: Nicolas Mattioli"
                autoComplete="name"
              />
            </label>

            <label>
              DNI / CUIT / Identificador
              <input
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                placeholder="Ej: 31193300"
                autoComplete="off"
              />
            </label>

            <label>
              Usuario
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Ej: nicolas"
                autoComplete="username"
              />
            </label>

            <label>
              Contrasena
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 8 caracteres"
                autoComplete="new-password"
              />
            </label>
          </div>

          {message && (
            <div className={createdUsername ? "success-banner" : "error-banner"}>
              {message}
              {createdUsername && (
                <strong className="register-created-user">
                  Usuario creado: {createdUsername}
                </strong>
              )}
            </div>
          )}

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar cuenta"}
          </button>
        </form>
      )}
    </section>
  );
}