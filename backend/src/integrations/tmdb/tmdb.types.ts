// Subconjunto de las respuestas de TMDB que usa la app
// (https://developer.themoviedb.org/reference)

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbVideo {
  site: string; // "YouTube"
  type: string; // "Trailer", "Teaser"...
  key: string;
  iso_639_1: string;
  official?: boolean;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TmdbCreator {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface TmdbMovie {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  overview: string | null;
  release_date: string | null; // "2019-05-30" o ""
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string | null;
  origin_country?: string[];
  production_countries?: { iso_3166_1: string }[];
  runtime: number | null;
  genres: TmdbGenre[];
  credits?: { crew: TmdbCrewMember[] };
  release_dates?: {
    results: {
      iso_3166_1: string;
      release_dates: { certification: string }[];
    }[];
  };
  videos?: { results: TmdbVideo[] };
}

export interface TmdbSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  status: string; // "Returning Series", "Ended", "Canceled", "In Production"...
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  original_language: string | null;
  origin_country?: string[];
  networks?: { name: string }[];
  genres: TmdbGenre[];
  created_by?: TmdbCreator[];
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  videos?: { results: TmdbVideo[] };
  external_ids?: { imdb_id: string | null };
}

export interface TmdbSearchResult {
  id: number;
  title?: string; // películas
  original_title?: string;
  release_date?: string;
  name?: string; // series
  original_name?: string;
  first_air_date?: string;
  overview: string | null;
  poster_path: string | null;
}

export interface TmdbSearchPage {
  page: number;
  results: TmdbSearchResult[];
  total_pages: number;
  total_results: number;
}
