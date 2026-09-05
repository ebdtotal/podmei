import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl text-ink">Não foi possível abrir esta tela</h1>
          <p className="mt-3 text-sm text-mute">{this.state.error.message}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a className="btn-primary" href="/">
              Ir para o início
            </a>
            <a className="btn-ghost" href="/entrar">
              Entrar
            </a>
            <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
