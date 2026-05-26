const axios = require('axios');

const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com';
const JSEARCH_PAGE_SIZE = Number(process.env.JSEARCH_PAGE_SIZE || 10);

/**
 * Search for real-time job listings via JSearch (RapidAPI).
 * @param {string} query    - e.g. "Software Engineer"
 * @param {string} location - e.g. "New York" (optional)
 * @param {number} page     - page number (default 1)
 * @returns {Promise<{jobs: object[], page: number, pageSize: number, hasMore: boolean}>} job results
 */
async function searchJobs({ query, location = '', page = 1 }) {
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY not configured');

  const searchQuery = location ? `${query} in ${location}` : query;

  const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
    params: {
      query: searchQuery,
      page:  String(page),
      num_pages: '1',
      date_posted: 'month'
    },
    headers: {
      'X-RapidAPI-Key':  RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST
    },
    timeout: 15000
  });

  const data = response.data?.data || [];
  const jobs = data.map(job => ({
    externalId:  job.job_id,
    company:     job.employer_name || 'Unknown',
    role:        job.job_title || 'Unknown',
    location:    [job.job_city, job.job_state, job.job_country]
                   .filter(Boolean).join(', ') || 'Remote',
    description: job.job_description || 'No description provided.',
    salary:      formatSalary(job),
    applyUrl:    job.job_apply_link || '',
    postedAt:    job.job_posted_at_datetime_utc || null,
    employerLogo: job.employer_logo || null,
    jobType:     job.job_employment_type || null,
    isRemote:    !!job.job_is_remote,
    source:      'jsearch'
  }));

  return {
    jobs,
    page: Number(page) || 1,
    pageSize: JSEARCH_PAGE_SIZE,
    hasMore: jobs.length >= JSEARCH_PAGE_SIZE
  };
}

function formatSalary(job) {
  if (!job.job_min_salary && !job.job_max_salary) return null;
  const currency = job.job_salary_currency || 'USD';
  const period   = job.job_salary_period   || 'YEAR';
  const min = job.job_min_salary ? `$${Math.round(job.job_min_salary / 1000)}k` : '';
  const max = job.job_max_salary ? `$${Math.round(job.job_max_salary / 1000)}k` : '';
  const range = [min, max].filter(Boolean).join(' – ');
  const suffix = period === 'YEAR' ? '/yr' : period === 'MONTH' ? '/mo' : '/hr';
  return range ? `${range} ${currency}${suffix}` : null;
}

module.exports = { searchJobs };
