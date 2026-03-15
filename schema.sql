-- Enable the pgvector extension
create extension if not exists vector;

-- Drop old table (switching from OpenAI 1536 to Gemini 3072 dimensions)
drop table if exists documents;

-- Create the documents table (3072 dimensions for Gemini gemini-embedding-001)
create table documents (
  id bigserial primary key,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(3072)
);

-- RPC function: match_documents
-- Returns the top N most similar documents to a query embedding
create or replace function match_documents (
  query_embedding vector(3072),
  match_count int default 3,
  filter jsonb default '{}'::jsonb
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where d.metadata @> filter
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
