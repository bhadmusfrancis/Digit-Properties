declare module 'flutterwave-node-v3' {
  class Flutterwave {
    constructor(publicKey: string, secretKey: string);
    PaymentLink: {
      initiate: (options: Record<string, unknown>) => Promise<{ data?: { link?: string } }>;
    };
  }
  export default Flutterwave;
}
