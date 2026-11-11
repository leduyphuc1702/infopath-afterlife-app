// Spec 24 W1: a net under the paper. An error while drawing it takes away the paper only: the
// record lives in the Worker, so the toolbar's Download XML still has every change, and the
// person can go back to the start.
import { Component, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
  /** A new value (the next answer, another record) draws the paper again. */
  readonly retry: unknown;
  readonly filling: boolean;
  readonly onHome: () => void;
}

export class DrawError extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(before: Props) {
    if (this.state.failed && before.retry !== this.props.retry) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="afl-banner afl-draw-error" role="alert">
        <p>
          This form could not be drawn, because of a fault in the viewer.{' '}
          {this.props.filling
            ? 'What you typed is kept: choose Download XML to save it, or Undo to try again.'
            : 'Choose another record or view to try again.'}
        </p>
        <button type="button" className="afl-button" onClick={this.props.onHome}>
          Back to the start
        </button>
      </div>
    );
  }
}
