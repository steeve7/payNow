"use client";

import {
  Mail,
  Phone,
  Send,
  MessageSquare,
  HelpCircle,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setStatusMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Failed to send message");
      }

      setSubmitStatus("success");
      setStatusMessage(result?.message || "Message sent successfully.");

      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
      });

      setTimeout(() => {
        setSubmitStatus("idle");
        setStatusMessage("");
      }, 5000);
    } catch (error: any) {
      setSubmitStatus("error");
      setStatusMessage(error?.message || "Failed to send message. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email Us",
      content: "support@paynow.ng",
      description: "We typically respond within 24 hours",
    },
    {
      icon: Phone,
      title: "Call Us",
      content: "+234 706 088 0335",
      description: "Mon-Fri: 9AM - 6PM WAT",
    },
  ];

  return (
    <div className="py-20">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-50 via-purple-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              Get in Touch
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Have questions? We're here to help. Reach out to our support team
            anytime.
          </p>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="grid md:grid-cols-2 gap-6 mb-20">
          {contactInfo.map((info, index) => {
            const Icon = info.icon;
            return (
              <div
                key={index}
                className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-primary-500/20">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {info.title}
                </h3>
                <p className="text-primary-600 font-semibold mb-1">
                  {info.content}
                </p>
                <p className="text-sm text-gray-600">{info.description}</p>
              </div>
            );
          })}
        </div>

        {/* Contact Form Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Form */}
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Send Us a Message
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="text-sm font-semibold text-gray-700 mb-2 block"
                >
                  Your Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-semibold text-gray-700 mb-2 block"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="text-sm font-semibold text-gray-700 mb-2 block"
                >
                  Subject
                </label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  required
                >
                  <option value="">Select a subject</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="billing">Billing Question</option>
                  <option value="partnership">Partnership</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="text-sm font-semibold text-gray-700 mb-2 block"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us how we can help you..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all resize-none"
                  required
                />
              </div>

              {submitStatus === "success" && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="text-green-800 text-sm">{statusMessage}</p>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-800 text-sm">{statusMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full gradient-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Send className="w-5 h-5" />
                <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
              </button>
            </form>
          </div>

          {/* Right side content (FAQ + Live chat) – kept as-is */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary-50 to-purple-50 p-8 rounded-2xl border border-primary-100">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
                  <HelpCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Frequently Asked Questions
                  </h3>
                  <p className="text-gray-600">
                    Find quick answers to common questions
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    How long does payment take to process?
                  </h4>
                  <p className="text-sm text-gray-600">
                    Most payments are processed instantly. You'll receive
                    confirmation within seconds.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Is my payment information secure?
                  </h4>
                  <p className="text-sm text-gray-600">
                    Yes! We use bank-grade encryption to protect all your
                    transactions and personal data.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    What is the Pay Later option?
                  </h4>
                  <p className="text-sm text-gray-600">
                    Our BNPL feature lets you pay bills now and settle the
                    amount later in installments.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-accent-50 to-green-50 p-8 rounded-2xl border border-accent-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-500/20">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Live Chat Support
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Get instant help from our support team
                  </p>
                  <a
                    href="https://wa.me/message/BG3EPX5BX62FE1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block gradient-accent text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-accent-500/30 hover:shadow-accent-500/50 transition-all hover:scale-105"
                  >
                    Start Chat
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
