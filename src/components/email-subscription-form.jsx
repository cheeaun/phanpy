/*
 * Temporary MVP email subscription form for testing
 * - There's no official API for this yet
 * - Strings are not translated
 * - Announcement: https://blog.joinmastodon.org/2026/06/mastodon-4.6/#newsletters
 */

import './email-subscription-form.css';

import { useState } from 'preact/hooks';

import { api } from '../utils/api';
import showToast from '../utils/show-toast';

function EmailSubscriptionForm({ accountId, instance }) {
  const { masto } = api({ instance });
  const [email, setEmail] = useState('');
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await masto.v1.accounts
        .$select(accountId)
        .emailSubscriptions.create({ email });
      showToast('Check your inbox');
    } catch (err) {
      console.error(err);
      showToast('Unable to subscribe');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form class="email-subscription-form" onSubmit={handleSubmit}>
      <input
        type="email"
        required
        value={email}
        onInput={(e) => {
          setEmail(e.target.value);
          setValid(e.target.validity.valid);
        }}
        disabled={submitting}
      />
      <button type="submit" disabled={submitting || !valid}>
        Subscribe
      </button>
    </form>
  );
}

export default EmailSubscriptionForm;
