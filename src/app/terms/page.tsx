import { Footer } from "@/components/landing/Footer"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"

export default function TermsPage() {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="container h-14 flex items-center px-4 lg:px-6 mt-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    Envault
                </Link>
            </header>
            <main className="flex-1 container max-w-3xl py-12 px-4 md:px-6">
                <h1 className="text-3xl font-bold tracking-tight mb-8">Terms of Service</h1>
                <div className="prose prose-stone dark:prose-invert max-w-none space-y-8">
                    <p className="lead">Last updated: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">1. Agreement to Terms</h2>
                        <p className="text-muted-foreground">
                            By accessing or using Envault ("Service"), you agree to be bound by these Terms of Service ("Terms").
                            If you disagree with any part of the terms, then you may not access the Service. These Terms apply to all visitors, users, and others who access or use the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">2. Accounts</h2>
                        <p className="text-muted-foreground mb-4">
                            When you create an account with us, you must provide us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                        </p>
                        <p className="text-muted-foreground">
                            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service.
                            You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">3. Intellectual Property</h2>
                        <p className="text-muted-foreground">
                            The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of Envault and its licensors.
                            The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.
                            Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Envault.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">4. User Responsibilities & Encryption</h2>
                        <p className="text-muted-foreground mb-4">
                            Envault provides tools for encrypting and managing environment variables. However, security is a shared responsibility.
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>You are responsible for managing your encryption keys and recovery phrases.</li>
                            <li>If you lose your encryption key, we <strong>cannot</strong> recover your data, as we do not store your private keys in plain text.</li>
                            <li>You agree not to use the Service to store illegal or malicious content.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">5. Links To Other Web Sites</h2>
                        <p className="text-muted-foreground">
                            Our Service may contain links to third-party web sites or services that are not owned or controlled by Envault.
                            Envault has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third party web sites or services.
                            You further acknowledge and agree that Envault shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with use of or reliance on any such content, goods or services available on or through any such web sites or services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">6. Termination</h2>
                        <p className="text-muted-foreground">
                            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                            Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">7. Limitation of Liability</h2>
                        <p className="text-muted-foreground">
                            In no event shall Envault, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage, and even if a remedy set forth herein is found to have failed of its essential purpose.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">8. Disclaimer</h2>
                        <p className="text-muted-foreground">
                            Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement or course of performance.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">9. Governing Law</h2>
                        <p className="text-muted-foreground">
                            These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.
                            Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">10. Changes</h2>
                        <p className="text-muted-foreground">
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                            By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, please stop using the Service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">11. Contact Us</h2>
                        <p className="text-muted-foreground">
                            If you have any questions about these Terms, please contact us at dashdinanath056@gmail.com.
                        </p>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    )
}
