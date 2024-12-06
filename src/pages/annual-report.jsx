import { t, Trans } from '@lingui/macro';

import './annual-report.css';

import { useEffect, useState } from 'preact/hooks';
import { useParams } from 'react-router-dom';

import Link from '../components/link';
import Loader from '../components/loader';
import NameText from '../components/name-text';
import Status from '../components/status';
import { api } from '../utils/api';
import useTitle from '../utils/useTitle';

export default function AnnualReport() {
  const params = useParams();
  const { year } = params;
  useTitle(year ? `Annual Report: ${year}` : 'Annual Report');
  const { masto, instance } = api();
  const [results, setResults] = useState(null);
  const [uiState, setUIState] = useState('default');

  useEffect(() => {
    if (year) {
      (async () => {
        setUIState('loading');
        const results = await masto.v1.annualReports.$select(year).fetch();
        console.log('REPORT', results);
        setResults(results);
        setUIState('default');
      })();
    }
  }, [year]);

  const { accounts, annualReports, statuses } = results || {};
  const report = annualReports?.find((report) => report.year == year)?.data;

  const datePlaceholder = new Date();

  return (
    <div id="annual-report-page" class="deck-container" tabIndex="-1">
      <div class="report">
        <h1>{year} #Wrapstodon</h1>
        {uiState === 'loading' && (
          <p>
            <Loader abrupt /> <Trans>Loading…</Trans>
          </p>
        )}
        {!!report && (
          <dl>
            {Object.entries(report).map(([key, value]) => (
              <>
                <dt>{key}</dt>
                <dd class={`report-${key}`}>
                  {Array.isArray(value) ? (
                    <table>
                      <thead>
                        <tr>
                          {Object.entries(value[0]).map(([key, value]) => (
                            <th
                              class={
                                key !== 'month' && typeof value === 'number'
                                  ? 'number'
                                  : ''
                              }
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {value.map((item) => (
                          <tr>
                            {Object.entries(item).map(([k, value]) => (
                              <td
                                class={
                                  k !== 'month' && typeof value === 'number'
                                    ? 'number'
                                    : ''
                                }
                              >
                                {value &&
                                /(accountId)/i.test(k) &&
                                /^(mostRebloggedAccounts|commonlyInteractedWithAccounts)$/i.test(
                                  key,
                                ) ? (
                                  <NameText
                                    account={accounts?.find(
                                      (a) => a.id === value,
                                    )}
                                    showAvatar
                                  />
                                ) : k === 'month' ? (
                                  datePlaceholder.setMonth(value - 1) &&
                                  datePlaceholder.toLocaleString(undefined, {
                                    month: 'long',
                                  })
                                ) : typeof value === 'number' ? (
                                  value.toLocaleString()
                                ) : (
                                  value
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : typeof value === 'object' ? (
                    /^(topStatuses)$/i.test(key) ? (
                      <dl>
                        {Object.entries(value).map(([k, value]) => (
                          <>
                            <dt>{k}</dt>
                            <dd>
                              {value && (
                                <Link to={`/${instance}/s/${value}`}>
                                  <Status
                                    status={statuses?.find(
                                      (s) => s.id === value,
                                    )}
                                    size="s"
                                    readOnly
                                  />
                                </Link>
                              )}
                            </dd>
                          </>
                        ))}
                      </dl>
                    ) : (
                      <table>
                        <tbody>
                          {Object.entries(value).map(([k, value]) => (
                            <tr>
                              <th>{k}</th>
                              <td
                                class={
                                  typeof value === 'number' ? 'number' : ''
                                }
                              >
                                {value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  ) : typeof value === 'string' ? (
                    value
                  ) : (
                    // Last resort
                    JSON.stringify(value, null, 2)
                  )}
                </dd>
              </>
            ))}
          </dl>
        )}
      </div>
      <hr />
      <p style={{ textAlign: 'center' }}>
        <Link to="/">
          <Trans>Go home</Trans>
        </Link>
      </p>
    </div>
  );
}
