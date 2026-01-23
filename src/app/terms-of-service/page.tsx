import {
  FileText,
  Scale,
  AlertCircle,
  Shield,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function TermsOfService() {
  const lastUpdated = "November 27, 2025";

  const sections = [
    {
      icon: FileText,
      title: "Acceptance of Terms",
      content: `
        <p>By accessing or using PayNow ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
        If you do not agree to these Terms, you may not use our Service.</p>
        <p>These Terms apply to all users of the Service, including without limitation users who are browsers, 
        customers, merchants, and contributors of content.</p>
      `,
    },
    {
      icon: CheckCircle,
      title: "Description of Service",
      content: `
        <p>PayNow provides a digital platform for paying utility bills including:</p>
        <ul>
          <li>Electricity bills (prepaid and postpaid meters)</li>
          <li>Mobile airtime purchases</li>
          <li>Internet data subscriptions</li>
          <li>Cable TV subscriptions (DSTV, GOtv, Startimes)</li>
          <li>Streaming services (Showmax)</li>
        </ul>
        <p>We act as an intermediary between you and the service providers. We do not provide the underlying 
        utility services themselves.</p>
      `,
    },
    {
      icon: Shield,
      title: "User Account and Registration",
      content: `
        <p>To use certain features of PayNow, you must:</p>
        <ul>
          <li>Create an account by signing in with Google OAuth</li>
          <li>Be at least 18 years old or have parental/guardian consent</li>
          <li>Provide accurate, current, and complete information</li>
          <li>Maintain and promptly update your account information</li>
          <li>Keep your account credentials secure and confidential</li>
          <li>Be responsible for all activities under your account</li>
          <li>Notify us immediately of any unauthorized access</li>
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate these Terms.</p>
      `,
    },
    {
      icon: Scale,
      title: "Payment Terms",
      content: `
        <p><strong>Transaction Processing:</strong></p>
        <ul>
          <li>All payments are processed in Nigerian Naira (₦)</li>
          <li>Transactions are typically completed within seconds</li>
          <li>Transaction tokens are provided as proof of payment</li>
          <li>Service delivery times depend on the utility provider</li>
        </ul>
        <p><strong>Pricing and Fees:</strong></p>
        <ul>
          <li>Prices displayed are inclusive of all applicable fees</li>
          <li>We reserve the right to change prices at any time</li>
          <li>You will be charged the price displayed at the time of transaction</li>
          <li>Convenience fees may apply to certain transactions</li>
        </ul>
        <p><strong>Payment Methods:</strong></p>
        <ul>
          <li>We accept various payment methods as displayed on the platform</li>
          <li>Payment processing is handled by secure third-party providers</li>
          <li>You are responsible for ensuring sufficient funds</li>
        </ul>
      `,
    },
    {
      icon: XCircle,
      title: "Refunds and Cancellations",
      content: `
        <p><strong>Refund Policy:</strong></p>
        <ul>
          <li>Refunds are only available for failed transactions</li>
          <li>Successfully completed transactions cannot be refunded</li>
          <li>Failed transaction refunds are processed within 5-7 business days</li>
          <li>Refunds are credited to the original payment method</li>
        </ul>
        <p><strong>Cancellations:</strong></p>
        <ul>
          <li>Transactions cannot be cancelled once initiated</li>
          <li>Ensure all details are correct before confirming payment</li>
          <li>Contact customer support immediately if you enter wrong information</li>
        </ul>
        <p><strong>Disputes:</strong></p>
        <ul>
          <li>Report transaction issues within 48 hours</li>
          <li>Provide transaction token and relevant details</li>
          <li>We will investigate and respond within 7 business days</li>
          <li>Final decisions on disputes are at our discretion</li>
        </ul>
      `,
    },
    {
      icon: AlertCircle,
      title: "Prohibited Activities",
      content: `
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service for any illegal or unauthorized purpose</li>
          <li>Violate any laws in your jurisdiction</li>
          <li>Infringe upon intellectual property rights</li>
          <li>Transmit viruses, malware, or harmful code</li>
          <li>Attempt to gain unauthorized access to our systems</li>
          <li>Use automated systems (bots, scrapers) without permission</li>
          <li>Impersonate any person or entity</li>
          <li>Engage in fraudulent activities</li>
          <li>Resell or commercially exploit the Service</li>
          <li>Harass, abuse, or harm other users</li>
          <li>Interfere with the proper functioning of the Service</li>
        </ul>
      `,
    },
  ];

  return (
    <div className="py-20 bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-50 via-purple-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30">
            <Scale className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              Terms of Service
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Please read these terms carefully before using PayNow. By using our
            service, you agree to these terms.
          </p>
          <p className="text-sm text-gray-500 mt-6">
            Last Updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="space-y-8">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mt-2">
                    {section.title}
                  </h2>
                </div>
                <div
                  className="prose prose-gray max-w-none
                    prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4
                    prose-ul:my-4 prose-li:text-gray-600 prose-li:mb-2
                    prose-strong:text-gray-900 prose-strong:font-semibold"
                  dangerouslySetInnerHTML={{ __html: section.content }}
                />
              </div>
            );
          })}

          {/* Intellectual Property */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Intellectual Property
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              The Service and its original content, features, and functionality
              are owned by PayNow and are protected by international copyright,
              trademark, patent, trade secret, and other intellectual property
              laws.
            </p>
            <ul className="space-y-2 text-gray-600">
              <li>
                • Our trademarks and trade dress may not be used without written
                permission
              </li>
              <li>• You may not copy, modify, or distribute our content</li>
              <li>• All rights not expressly granted are reserved</li>
            </ul>
          </div>

          {/* Limitation of Liability */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Limitation of Liability
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              To the maximum extent permitted by law, PayNow shall not be liable
              for:
            </p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li>
                • Indirect, incidental, special, consequential, or punitive
                damages
              </li>
              <li>• Loss of profits, revenue, data, or use</li>
              <li>• Service interruptions or delays</li>
              <li>• Actions or failures of third-party service providers</li>
              <li>• Unauthorized access to your account or data</li>
              <li>• Errors or inaccuracies in content</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">
              Our total liability shall not exceed the amount you paid us in the
              12 months preceding the claim.
            </p>
          </div>

          {/* Disclaimer of Warranties */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Disclaimer of Warranties
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              The Service is provided "AS IS" and "AS AVAILABLE" without
              warranties of any kind, either express or implied, including:
            </p>
            <ul className="space-y-2 text-gray-600">
              <li>• Merchantability or fitness for a particular purpose</li>
              <li>• Non-infringement of third-party rights</li>
              <li>• Uninterrupted, timely, secure, or error-free operation</li>
              <li>• Accuracy, reliability, or completeness of content</li>
              <li>• Freedom from viruses or harmful components</li>
            </ul>
          </div>

          {/* Indemnification */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Indemnification
            </h2>
            <p className="text-gray-600 leading-relaxed">
              You agree to indemnify, defend, and hold harmless PayNow, its
              officers, directors, employees, and agents from any claims,
              damages, losses, liabilities, and expenses (including legal fees)
              arising from:
            </p>
            <ul className="space-y-2 text-gray-600 mt-4">
              <li>• Your use or misuse of the Service</li>
              <li>• Your violation of these Terms</li>
              <li>• Your violation of any rights of another party</li>
              <li>• Any content you submit through the Service</li>
            </ul>
          </div>

          {/* Governing Law */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Governing Law and Jurisdiction
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with
              the laws of the Federal Republic of Nigeria, without regard to its
              conflict of law provisions.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Any disputes arising from these Terms or your use of the Service
              shall be subject to the exclusive jurisdiction of the courts
              located in Lagos, Nigeria.
            </p>
          </div>

          {/* Changes to Terms */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Changes to Terms
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. Changes
              will be effective immediately upon posting to the Service with an
              updated "Last Updated" date.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Your continued use of the Service after changes constitutes
              acceptance of the modified Terms. If you do not agree to the
              changes, you must stop using the Service.
            </p>
          </div>

          {/* Termination */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Termination
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We may terminate or suspend your account and access to the Service
              immediately, without prior notice or liability, for any reason,
              including:
            </p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li>• Breach of these Terms</li>
              <li>• Fraudulent or illegal activity</li>
              <li>• At your request</li>
              <li>• Extended period of inactivity</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">
              Upon termination, your right to use the Service will immediately
              cease. All provisions of these Terms which by their nature should
              survive termination shall survive.
            </p>
          </div>

          {/* Severability */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Severability
            </h2>
            <p className="text-gray-600 leading-relaxed">
              If any provision of these Terms is found to be unenforceable or
              invalid, that provision will be limited or eliminated to the
              minimum extent necessary, and the remaining provisions will remain
              in full force and effect.
            </p>
          </div>

          {/* Entire Agreement */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Entire Agreement
            </h2>
            <p className="text-gray-600 leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the
              entire agreement between you and PayNow regarding the Service and
              supersede all prior agreements and understandings.
            </p>
          </div>

          {/* Contact Us */}
          <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl p-8 border border-primary-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Questions About These Terms?
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please
              contact us:
            </p>
            <div className="space-y-3 text-gray-700">
              <p>
                <strong>Email:</strong> support@paynow.ng
              </p>
              <p>
                <strong>Phone:</strong> +234 800 000 0000
              </p>
              <p>
                <strong>Address:</strong> Victoria Island, Lagos, Nigeria
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
