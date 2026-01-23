import { Shield, Lock, Eye, UserCheck, Database, Globe } from "lucide-react";

export default function PrivacyPolicy() {
  const lastUpdated = "November 27, 2025";

  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      content: `
        <p>We collect information that you provide directly to us when using PayNow:</p>
        <ul>
          <li><strong>Account Information:</strong> When you sign in with Google, we collect your name, email address, and profile picture.</li>
          <li><strong>Payment Information:</strong> Bill payment details including meter numbers, phone numbers, smartcard numbers, and transaction amounts.</li>
          <li><strong>Transaction History:</strong> Records of all payments you make through our platform.</li>
          <li><strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers.</li>
          <li><strong>Usage Data:</strong> Information about how you interact with our services, including pages visited and features used.</li>
        </ul>
      `,
    },
    {
      icon: Lock,
      title: "How We Use Your Information",
      content: `
        <p>We use the information we collect to:</p>
        <ul>
          <li>Process your bill payments and provide transaction confirmations</li>
          <li>Maintain and improve our services</li>
          <li>Communicate with you about your transactions and account</li>
          <li>Detect and prevent fraud and security issues</li>
          <li>Comply with legal obligations and enforce our terms</li>
          <li>Analyze usage patterns to enhance user experience</li>
          <li>Send you updates about new features and services (you can opt out anytime)</li>
        </ul>
      `,
    },
    {
      icon: UserCheck,
      title: "Information Sharing",
      content: `
        <p>We do not sell your personal information. We may share your information only in these circumstances:</p>
        <ul>
          <li><strong>Service Providers:</strong> With utility companies and bill payment processors to complete your transactions.</li>
          <li><strong>Legal Requirements:</strong> When required by law, legal process, or government request.</li>
          <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
          <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information.</li>
          <li><strong>Fraud Prevention:</strong> To prevent fraud, security threats, or illegal activities.</li>
        </ul>
      `,
    },
    {
      icon: Shield,
      title: "Data Security",
      content: `
        <p>We implement industry-standard security measures to protect your information:</p>
        <ul>
          <li>Bank-grade encryption for all data transmission (TLS/SSL)</li>
          <li>Encrypted storage of sensitive information</li>
          <li>Regular security audits and monitoring</li>
          <li>Secure authentication through Google OAuth</li>
          <li>Limited employee access to personal data</li>
          <li>Regular security training for our team</li>
        </ul>
        <p>While we strive to protect your data, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.</p>
      `,
    },
    {
      icon: Eye,
      title: "Your Rights and Choices",
      content: `
        <p>You have the following rights regarding your personal information:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
          <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information.</li>
          <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
          <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time.</li>
          <li><strong>Data Portability:</strong> Request your data in a machine-readable format.</li>
          <li><strong>Restrict Processing:</strong> Request limitation of how we process your data.</li>
        </ul>
        <p>To exercise these rights, contact us at support@paynow.ng</p>
      `,
    },
    {
      icon: Globe,
      title: "Cookies and Tracking",
      content: `
        <p>We use cookies and similar technologies to:</p>
        <ul>
          <li>Remember your preferences and settings</li>
          <li>Maintain your login session</li>
          <li>Analyze site traffic and usage patterns</li>
          <li>Improve our services and user experience</li>
        </ul>
        <p>You can control cookies through your browser settings. Disabling cookies may limit functionality of our services.</p>
      `,
    },
  ];

  return (
    <div className="py-20 bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-50 via-purple-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              Privacy Policy
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Your privacy is important to us. This policy explains how we
            collect, use, and protect your personal information.
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

          {/* Data Retention */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Data Retention
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We retain your personal information for as long as necessary to
              provide our services and comply with legal obligations:
            </p>
            <ul className="space-y-2 text-gray-600">
              <li>
                • Account information: Retained while your account is active
              </li>
              <li>
                • Transaction records: Retained for 7 years for tax and legal
                purposes
              </li>
              <li>
                • Marketing data: Retained until you opt out or request deletion
              </li>
              <li>• Analytics data: Aggregated and anonymized after 2 years</li>
            </ul>
          </div>

          {/* Children's Privacy */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Children's Privacy
            </h2>
            <p className="text-gray-600 leading-relaxed">
              PayNow is not intended for users under the age of 18. We do not
              knowingly collect personal information from children. If you
              believe we have collected information from a child, please contact
              us immediately at support@paynow.ng.
            </p>
          </div>

          {/* International Users */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              International Users
            </h2>
            <p className="text-gray-600 leading-relaxed">
              PayNow operates primarily in Nigeria. If you access our services
              from outside Nigeria, your information may be transferred to and
              processed in Nigeria. By using our services, you consent to this
              transfer and processing.
            </p>
          </div>

          {/* Changes to Policy */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Changes to This Policy
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by:
            </p>
            <ul className="space-y-2 text-gray-600 mb-4">
              <li>
                • Posting the updated policy on this page with a new "Last
                Updated" date
              </li>
              <li>
                • Sending you an email notification (for significant changes)
              </li>
              <li>• Displaying a notice on our platform</li>
            </ul>
            <p className="text-gray-600 leading-relaxed">
              Your continued use of PayNow after changes are posted constitutes
              acceptance of the updated policy.
            </p>
          </div>

          {/* Contact Us */}
          <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl p-8 border border-primary-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Contact Us
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              If you have questions about this Privacy Policy or our data
              practices, please contact us:
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
