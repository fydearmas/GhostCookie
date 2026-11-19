"""Native credential setup for the published Ghost Cookie companion."""

import io
import subprocess
import sys
import tkinter as tk
import webbrowser
from pathlib import Path
from queue import Empty, Queue
from threading import Thread
from tkinter import messagebox, ttk

from assistant import (
    API_KEY,
    CompanionError,
    read_message,
    register_published,
    write_message,
)

HOST_EXECUTABLE = "ghostcookie-host.exe" if sys.platform == "win32" else "ghostcookie-host"
KEYS_PAGE = "https://aistudio.google.com/api-keys"


def call_local_host(host, action, key=None):
    message = {"action": action}
    if key is not None:
        message["key"] = key
    source = io.BytesIO()
    write_message(source, message)
    try:
        result = subprocess.run(
            [str(host), "setup-command"],
            input=source.getvalue(),
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            timeout=45,
            check=True,
        )
        reply = read_message(io.BytesIO(result.stdout))
        if isinstance(reply, dict) and isinstance(reply.get("ok"), bool):
            return reply
    except (OSError, subprocess.SubprocessError, CompanionError):
        pass
    return {"ok": False, "error": "El asistente local no respondió. Vuelve a abrir la aplicación."}


class SetupApp:
    def __init__(self, root, host):
        self.root = root
        self.host = host
        self.connected = False
        self.pending = False
        self.status = tk.StringVar(value="Preparando la conexión a Chrome y Edge…")
        root.title("Asistente de Ghost Cookie")
        root.resizable(True, False)
        root.columnconfigure(0, weight=1)

        panel = ttk.Frame(root, padding=24)
        panel.grid(sticky="nsew")
        panel.columnconfigure(0, weight=1)
        ttk.Label(panel, text="Asistente de Ghost Cookie", font=("TkDefaultFont", 15, "bold")).grid(sticky="w")
        ttk.Label(
            panel,
            text="Conecta tu propia cuenta de Gemini. La clave se guarda en el llavero de tu sistema.",
            wraplength=380,
        ).grid(sticky="w", pady=(8, 18))

        ttk.Label(panel, text="Clave de Gemini").grid(sticky="w")
        self.entry = ttk.Entry(panel, show="*", width=44)
        self.entry.grid(sticky="ew", pady=(4, 10))
        self.entry.bind("<Return>", self.save_key)

        actions = ttk.Frame(panel)
        actions.grid(sticky="ew")
        self.save = ttk.Button(actions, text="Guardar clave", command=self.save_key, state="disabled")
        self.save.pack(side="left")
        self.remove = ttk.Button(actions, text="Quitar clave", command=self.delete_key)
        self.remove.pack(side="left", padx=(8, 0))
        ttk.Button(actions, text="Obtener clave", command=lambda: webbrowser.open(KEYS_PAGE)).pack(side="right")

        ttk.Separator(panel).grid(sticky="ew", pady=(18, 12))
        ttk.Label(panel, textvariable=self.status, wraplength=380).grid(sticky="w")
        self.reconnect = ttk.Button(panel, text="Volver a conectar", command=self.connect)
        self.reconnect.grid(sticky="w", pady=(8, 0))
        root.after_idle(self.connect)

    def connect(self):
        try:
            register_published(self.host)
        except CompanionError as exc:
            self.status.set(str(exc))
        except OSError:
            self.status.set("No se pudo registrar el asistente para esta cuenta del sistema.")
        else:
            self.connected = True
            self.run_job("status", "Consultando el llavero…")
            return
        self.connected = False
        self.save.state(["disabled"])

    def run_job(self, action, status, key=None):
        self.pending = True
        self.status.set(status)
        for button in (self.save, self.remove, self.reconnect):
            button.state(["disabled"])
        replies = Queue()

        def receive_reply():
            try:
                reply = replies.get_nowait()
            except Empty:
                self.root.after(75, receive_reply)
                return
            self.pending = False
            if self.connected:
                self.save.state(["!disabled"])
            self.remove.state(["!disabled"])
            self.reconnect.state(["!disabled"])
            self.update_status(reply)
            self.entry.focus_set()

        Thread(target=lambda: replies.put(call_local_host(self.host, action, key)), daemon=True).start()
        self.root.after(75, receive_reply)

    def update_status(self, reply):
        if reply.get("ok"):
            if reply.get("configured"):
                self.status.set("Clave guardada. Ya puedes activar el asistente en Ghost Cookie.")
            else:
                self.status.set("Falta guardar tu clave de Gemini.")
        else:
            self.status.set(reply.get("error", "No se pudo consultar el llavero."))

    def save_key(self, _event=None):
        if not self.connected or self.pending:
            return
        key = self.entry.get().strip()
        if not key:
            self.status.set("Introduce tu clave de Gemini.")
            return
        if not API_KEY.fullmatch(key):
            self.status.set("La clave tiene un formato inesperado.")
            return
        self.entry.delete(0, "end")
        self.run_job("save", "Guardando en el llavero…", key)

    def delete_key(self):
        if messagebox.askyesno(
            "Quitar clave de Gemini",
            "¿Quieres eliminar la clave guardada de Ghost Cookie en tu llavero?",
            parent=self.root,
        ):
            self.entry.delete(0, "end")
            self.run_job("remove", "Quitando la clave del llavero…")


def main():
    executable = Path(sys.executable) if getattr(sys, "frozen", False) else Path(__file__)
    root = tk.Tk()
    SetupApp(root, executable.with_name(HOST_EXECUTABLE))
    root.mainloop()


if __name__ == "__main__":
    main()
