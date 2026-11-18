import {serverApi, HomeData, Issue, Activity, Notice, PageData} from '@/lib/api';
import HomePage from '@/components/HomePage';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let data: HomeData = {latest_issue: null, recent_issues: [], featured_articles: []};
  let unavailable = false;
  try {
    data = await serverApi<HomeData>('/home');
    if (data.latest_issue) {
      try {
        const issue = await serverApi<Issue>(`/issues/${data.latest_issue.slug}`);
        data.latest_issue = issue;
        data.featured_articles = issue.sections?.flatMap(section => section.articles) ?? data.featured_articles;
      } catch {
        data.featured_articles = data.featured_articles.filter(article => article.issue_id === data.latest_issue?.id);
      }
    }
  } catch { unavailable = true; }
  const [activities, notices] = await Promise.all([
    serverApi<PageData<Activity>>('/activities?limit=4').then(r => r.items).catch(() => [] as Activity[]),
    serverApi<PageData<Notice>>('/notices?limit=4').then(r => r.items).catch(() => [] as Notice[]),
  ]);
  return <HomePage data={data} unavailable={unavailable} activities={activities} notices={notices}/>;
}
