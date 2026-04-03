declare module "node-notifier" {
  export type NotifyOptions = {
    title?: string;
    message?: string;
    open?: string;
    sound?: boolean | string;
    wait?: boolean;
    timeout?: number | false;
  };

  export function notify(
    options: NotifyOptions,
    callback?: (err: Error | null) => void,
  ): void;

  const notifier: {
    notify: typeof notify;
  };

  export default notifier;
}
