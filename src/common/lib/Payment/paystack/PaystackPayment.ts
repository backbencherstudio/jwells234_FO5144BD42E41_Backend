import axios from 'axios';
import appConfig from '../../../../config/app.config';

const PAYSTACK_SECRET_KEY = appConfig().payment.paystack.secret_key;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackPayment {
  private static getHeaders() {
    return {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a customer in Paystack
   */
  static async createCustomer({
    email,
    first_name,
    last_name,
    phone,
  }: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/customer`,
        {
          email,
          first_name,
          last_name,
          phone,
        },
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      // If customer already exists, Paystack might return error or existing customer.
      // We can try to fetch customer if creation fails due to duplicate
      console.error('Paystack createCustomer error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create Paystack customer');
    }
  }

  /**
   * Create a subscription plan
   */
  static async createPlan({
    name,
    amount, // in kobo (NGN * 100)
    interval, // hourly, daily, weekly, monthly, quarterly, biannually, annually
    description,
  }: {
    name: string;
    amount: number;
    interval: string;
    description?: string;
  }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/plan`,
        {
          name,
          amount,
          interval,
          description,
        },
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack createPlan error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create Paystack plan');
    }
  }

  /**
   * Initialize a transaction (for first time subscription)
   */
  static async initializeTransaction({
    email,
    amount,
    plan, // plan code
    callback_url,
    metadata,
  }: {
    email: string;
    amount: number;
    plan?: string;
    callback_url?: string;
    metadata?: any;
  }) {
    try {
      const payload: any = {
        email,
        amount,
        callback_url,
        metadata,
      };
      if (plan) {
        payload.plan = plan;
      }

      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        payload,
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack initializeTransaction error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to initialize Paystack transaction');
    }
  }

  /**
   * Verify a transaction
   */
  static async verifyTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack verifyTransaction error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify Paystack transaction');
    }
  }

  /**
   * Fetch subscription details
   */
  static async fetchSubscription(idOrCode: string) {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/subscription/${idOrCode}`,
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack fetchSubscription error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to fetch Paystack subscription');
    }
  }

  /**
   * List subscriptions
   */
  static async listSubscriptions({
    customer,
    plan,
  }: {
    customer?: number; // customer ID (not code)
    plan?: number; // plan ID (not code)
  }) {
    try {
      const params: any = {};
      if (customer) params.customer = customer;
      if (plan) params.plan = plan;

      const response = await axios.get(`${PAYSTACK_BASE_URL}/subscription`, {
        headers: this.getHeaders(),
        params,
      });
      return response.data.data;
    } catch (error) {
      console.error(
        'Paystack listSubscriptions error:',
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.message || 'Failed to list Paystack subscriptions',
      );
    }
  }

  /**
   * Disable (Cancel) Subscription
   */
  static async disableSubscription({ code, token }: { code: string; token: string }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/subscription/disable`,
        { code, token },
        { headers: this.getHeaders() },
      );
      return response.data;
    } catch (error) {
      console.error('Paystack disableSubscription error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to disable Paystack subscription');
    }
  }

  /**
   * Create a subscription
   */
  static async createSubscription({
    customer,
    plan,
    authorization,
    start_date,
  }: {
    customer: string;
    plan: string;
    authorization: string;
    start_date?: string;
  }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/subscription`,
        {
          customer,
          plan,
          authorization,
          start_date,
        },
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error(
        'Paystack createSubscription error:',
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.message || 'Failed to create Paystack subscription',
      );
    }
  }

  /**
   * Charge a card directly
   */
  static async chargeCard(payload: {
    email: string;
    amount: string; // in kobo
    card: {
      number: string;
      cvv: string;
      expiry_month: string;
      expiry_year: string;
    };
    pin?: string;
    plan?: string; // plan code
    reference?: string;
    metadata?: any;
  }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/charge`,
        payload,
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack chargeCard error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to charge card');
    }
  }

  /**
   * Submit OTP for Charge
   */
  static async submitOtp({ otp, reference }: { otp: string; reference: string }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/charge/submit_otp`,
        { otp, reference },
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack submitOtp error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to submit OTP');
    }
  }

  /**
   * Submit PIN for Charge
   */
  static async submitPin({ pin, reference }: { pin: string; reference: string }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/charge/submit_pin`,
        { pin, reference },
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack submitPin error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to submit PIN');
    }
  }

  /**
   * Check Pending Charge
   */
  static async checkPendingCharge(reference: string) {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/charge/${reference}`,
        { headers: this.getHeaders() },
      );
      return response.data.data;
    } catch (error) {
      console.error('Paystack checkPendingCharge error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to check charge status');
    }
  }
}

