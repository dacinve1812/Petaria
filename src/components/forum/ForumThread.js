import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../UserContext';
import ForumEditor from './ForumEditor';
import { forumMarkdownToHtml } from './forumMarkdown';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN');
}

function buildCommentTree(comments) {
  const byId = new Map();
  const roots = [];
  for (const c of comments) {
    byId.set(c.id, { ...c, children: [] });
  }
  for (const c of byId.values()) {
    if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
      byId.get(c.parent_comment_id).children.push(c);
    } else {
      roots.push(c);
    }
  }
  const sortRec = (nodeList) => {
    nodeList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const n of nodeList) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

function buildCommentPostNumbers(roots) {
  const map = new Map();
  let n = 2;
  const walk = (nodes) => {
    for (const node of nodes) {
      map.set(node.id, n);
      n += 1;
      if (node.children?.length) walk(node.children);
    }
  };
  walk(roots);
  return map;
}

function displayNameOf(author) {
  return author?.display_name || author?.username || 'Người chơi';
}

function initialLetter(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  return s.charAt(0).toUpperCase();
}

function hashString(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

const AVATAR_HUES = [8, 28, 168, 200, 265, 310, 140, 32];

function avatarPalette(key) {
  const idx = hashString(key) % AVATAR_HUES.length;
  const h = AVATAR_HUES[idx];
  return {
    background: `hsl(${h} 52% 36%)`,
    color: 'rgba(255,255,255,0.96)',
  };
}

function resolveAvatarUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const u = url.trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return `${API_BASE_URL}${u}`;
  return `${API_BASE_URL}/${u.replace(/^\//, '')}`;
}

function roleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'Quản trị';
  if (r === 'mod' || r === 'moderator') return 'Điều hành';
  return '';
}

function ForumAvatar({ name, avatarUrl, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const display = displayNameOf({ display_name: null, username: name });
  const letter = initialLetter(display);
  const pal = avatarPalette(display);
  const src = resolveAvatarUrl(avatarUrl);
  const showImg = !!src && !broken;

  const cls = size === 'sm' ? 'forumAvatar forumAvatar--sm' : 'forumAvatar';

  return (
    <div className={cls} style={showImg ? undefined : pal} aria-hidden={showImg ? undefined : true}>
      {showImg ? (
        <img
          className="forumAvatarImg"
          src={src}
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="forumAvatarLetter">{letter}</span>
      )}
    </div>
  );
}

function ForumAuthorPane({ author, variant = 'thread' }) {
  const name = displayNameOf(author);
  const rl = roleLabel(author?.author_role);
  const online =
    author?.author_online_status === 1 ||
    author?.author_online_status === true ||
    Number(author?.author_online_status) === 1;

  const cardCls =
    variant === 'compact' ? 'forumUserCard forumUserCard--compact' : 'forumUserCard';

  return (
    <aside className={cardCls}>
      <ForumAvatar name={name} avatarUrl={author?.avatar_url} size={variant === 'compact' ? 'sm' : 'md'} />
      <div className="forumUserText">
        <div className="forumUserName">{name}</div>
        {rl ? (
          <div className="forumUserBadge" title={String(author?.author_role || '')}>
            {rl}
          </div>
        ) : null}
        <div className={`forumUserPresence ${online ? 'isOnline' : 'isOffline'}`}>
          <span className="forumUserPresenceDot" />
          {online ? 'Đang online' : 'Offline'}
        </div>
        {author?.username ? (
          <div className="forumUserHandle">@{author.username}</div>
        ) : null}
      </div>
    </aside>
  );
}

function ForumPostMetaBar({ left, right }) {
  return (
    <div className="forumPostMetaBar">
      <div className="forumPostMetaLeft">{left}</div>
      <div className="forumPostMetaRight">{right}</div>
    </div>
  );
}

function MarkdownView({ text }) {
  const html = forumMarkdownToHtml(text);
  return (
    <div
      className="forumMarkdownBody"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function CommentNode({ node, depth = 0, postNumberById, onReply }) {
  const postNo = postNumberById.get(node.id) || node.id;
  return (
    <div className="forumCommentWrap" style={{ marginLeft: Math.min(18 * depth, 72) }}>
      <div className="forumPostShell">
        <ForumAuthorPane author={node} variant="compact" />
        <div className="forumPostMain">
          <ForumPostMetaBar
            left={<span>{formatTime(node.created_at)}</span>}
            right={<span className="forumPostNo">#{postNo}</span>}
          />
          <div className="forumPostBody">
            <MarkdownView text={node.body_markdown} />
          </div>
          <div className="forumCommentActions">
            <button className="forumLinkBtn" type="button" onClick={() => onReply(node.id)}>
              Trả lời
            </button>
          </div>
        </div>
      </div>
      {node.children?.length ? (
        <div className="forumCommentChildren">
          {node.children.map((ch) => (
            <CommentNode key={ch.id} node={ch} depth={depth + 1} postNumberById={postNumberById} onReply={onReply} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ForumThread() {
  const { categorySlug, threadId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUser();

  const [thread, setThread] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const tree = useMemo(() => buildCommentTree(comments), [comments]);
  const commentPostNumbers = useMemo(() => buildCommentPostNumbers(tree), [tree]);
  const canPost = useMemo(() => isAuthenticated && !!user?.token, [isAuthenticated, user?.token]);
  const canManageThread = useMemo(() => {
    if (!canPost || !thread) return false;
    const isOwner = Number(thread.author_user_id) === Number(user?.userId);
    const isAdmin = !!user?.isAdmin;
    return isOwner || isAdmin;
  }, [canPost, thread, user?.userId, user?.isAdmin]);

  const threadAuthorPayload = useMemo(() => {
    if (!thread) return null;
    return {
      author_user_id: thread.author_user_id,
      username: thread.username,
      display_name: thread.display_name,
      avatar_url: thread.avatar_url,
      author_role: thread.author_role,
      author_online_status: thread.author_online_status,
    };
  }, [thread]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`${API_BASE_URL}/api/forum/threads/${encodeURIComponent(threadId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setThread(data.thread || null);
        setComments(Array.isArray(data.comments) ? data.comments : []);
      } catch (e) {
        if (!alive) return;
        setError('Không thể tải thread.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [threadId]);

  const uploadImage = async (file) => {
    if (!canPost) return null;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API_BASE_URL}/api/forum/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: fd,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.url || null;
  };

  const submitComment = async () => {
    if (!canPost) {
      setError('Bạn cần đăng nhập để bình luận.');
      return;
    }
    if (!commentText.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/forum/threads/${encodeURIComponent(threadId)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          content: commentText,
          parentCommentId: replyTo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Không thể gửi comment');
      const reload = await fetch(`${API_BASE_URL}/api/forum/threads/${encodeURIComponent(threadId)}`);
      const reData = await reload.json().catch(() => ({}));
      setThread(reData.thread || thread);
      setComments(Array.isArray(reData.comments) ? reData.comments : comments);
      setCommentText('');
      setReplyTo(null);
    } catch (e) {
      setError(e?.message || 'Không thể gửi comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="forumCard">Đang tải...</div>;
  if (error && !thread) return <div className="forumCard forumError">{error}</div>;
  if (!thread) return <div className="forumCard forumError">Thread không tồn tại.</div>;

  const views = Number(thread.view_count || 0).toLocaleString('vi-VN');

  return (
    <div className="forumCard">
      {error ? <div className="forumError" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="forumThreadTop">
        <div className="forumThreadTopMain">
          <div className="forumBreadcrumbs">
            <Link to="/forum">Forum</Link>
            <span className="forumCrumbSep">/</span>
            <Link to={`/forum/${categorySlug}`}>{thread.category_name || categorySlug}</Link>
          </div>

          <div className="forumThreadHero">
            <div className="forumThreadHeroTitleRow">
              <h1 className="forumThreadTitle">{thread.title}</h1>
              <div className="forumThreadHeroBadges">
                {thread.is_pinned ? <span className="forumBadge">Ghim</span> : null}
                {thread.is_locked ? <span className="forumBadge forumBadgeMuted">Khóa</span> : null}
              </div>
            </div>
            <div className="forumThreadHeroSub">
              <span className="forumThreadHeroDot">★</span>
              <span>
                {formatTime(thread.created_at)} • {views} lượt xem
              </span>
            </div>
          </div>
        </div>

        {canManageThread ? (
          <div className="forumActions forumThreadActions">
            <Link className="forumBtn" to={`/forum/${categorySlug}/${threadId}/edit`}>
              Sửa
            </Link>
            <button
              className="forumBtn forumBtnDanger"
              type="button"
              onClick={async () => {
                if (!window.confirm('Xóa thread này? Hành động này không thể hoàn tác.')) return;
                try {
                  const res = await fetch(`${API_BASE_URL}/api/forum/threads/${encodeURIComponent(threadId)}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${user.token}` },
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data?.message || 'Không thể xóa thread');
                  navigate(`/forum/${categorySlug}`);
                } catch (e) {
                  setError(e?.message || 'Không thể xóa thread');
                }
              }}
            >
              Xóa
            </button>
          </div>
        ) : null}
      </div>

      <div className="forumPostShell forumPostShell--op">
        <ForumAuthorPane author={threadAuthorPayload} />
        <div className="forumPostMain">
          <ForumPostMetaBar
            left={<span>{formatTime(thread.created_at)}</span>}
            right={<span className="forumPostNo">#1</span>}
          />
          <div className="forumPostBody">
            <MarkdownView text={thread.body_markdown} />
          </div>
        </div>
      </div>

      <div className="forumSectionTitle">Bình luận</div>

      {tree.length ? (
        <div className="forumComments">
          {tree.map((n) => (
            <CommentNode
              key={n.id}
              node={n}
              postNumberById={commentPostNumbers}
              onReply={(id) => setReplyTo(id)}
            />
          ))}
        </div>
      ) : (
        <div className="forumEmpty">Chưa có bình luận.</div>
      )}

      <div className="forumSectionTitle">Viết bình luận</div>
      {!canPost ? (
        <div className="forumError">
          Bạn cần <Link to="/login">đăng nhập</Link> để bình luận.
        </div>
      ) : null}

      {replyTo ? (
        <div className="forumReplyPill">
          Đang trả lời comment <b>#{replyTo}</b>{' '}
          <button className="forumLinkBtn" type="button" onClick={() => setReplyTo(null)}>
            (bỏ)
          </button>
        </div>
      ) : null}

      <ForumEditor
        value={commentText}
        onChange={setCommentText}
        onUploadImage={uploadImage}
        disabled={submitting || !canPost}
        placeholder="Viết comment (markdown)."
      />

      <div className="forumActions">
        <button className="forumBtn forumBtnPrimary" type="button" disabled={submitting || !canPost} onClick={submitComment}>
          {submitting ? 'Đang gửi...' : 'Gửi bình luận'}
        </button>
      </div>
    </div>
  );
}
