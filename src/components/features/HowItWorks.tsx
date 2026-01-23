import {
  CheckCircle,
  Smartphone,
  CreditCard,
  Bell,
  TrendingUp,
  Shield,
} from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Choose Your Bill",
      description:
        "Select the type of bill you want to pay - electricity, airtime, data, or cable TV.",
      icon: Smartphone,
    },
    {
      number: "02",
      title: "Enter Details",
      description:
        "Provide your account number and the amount you want to pay.",
      icon: CreditCard,
    },
    {
      number: "03",
      title: "Complete Payment",
      description:
        "Pay securely with your preferred payment method. Get instant confirmation.",
      icon: CheckCircle,
    },
  ];

  const features = [
    {
      title: "Bill Aggregator",
      description:
        "Access all your bills in one place. No need to visit multiple platforms.",
      icon: TrendingUp,
    },
    {
      title: "Pay Later Option",
      description:
        "Use our Buy Now Pay Later feature when cash is tight. Pay bills now, settle later.",
      icon: CreditCard,
    },
    {
      title: "Transaction History",
      description:
        "Track all your payments with detailed transaction history. Download or share receipts anytime.",
      icon: Bell,
    },
    {
      title: "Secure Payments",
      description:
        "Bank-grade security ensures your money and data are always protected.",
      icon: Shield,
    },
  ];

  return (
    <div className="py-20">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-50 via-purple-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              How PayNow Works
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Pay your bills in three simple steps. Fast, secure, and hassle-free.
          </p>
        </div>
      </div>

      {/* Steps Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-3 gap-12">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-primary-300 to-purple-300 -z-10" />
                )}

                <div className="text-center">
                  <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30">
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-6xl font-bold text-primary-100 mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to manage your bills efficiently
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-shadow"
                >
                  <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-primary-500/20">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="gradient-primary rounded-3xl p-12 text-center shadow-2xl">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join thousands of Nigerians who trust PayNow for their bill payments
          </p>
          <button className="bg-white text-primary-700 px-8 py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-white/50 transition-all hover:scale-105">
            Start Paying Bills Now
          </button>
        </div>
      </div>
    </div>
  );
}
