--
-- PostgreSQL database dump
--

-- Dumped from database version 15.4 (Debian 15.4-2.pgdg120+1)
-- Dumped by pg_dump version 17.2

-- Started on 2025-09-05 15:06:34

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3 (class 3079 OID 47389)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 3508 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 2 (class 3079 OID 39030)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3509 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 928 (class 1247 OID 47288)
-- Name: event_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.event_type AS ENUM (
    'APP_START',
    'APP_SHUTDOWN',
    'CONFIG_UPDATE',
    'COMMUNICATION_ERROR',
    'VERSION_UPDATE',
    'AEAT_CONFIRMED',
    'AEAT_REJECTED'
);


ALTER TYPE public.event_type OWNER TO postgres;

--
-- TOC entry 910 (class 1247 OID 39003)
-- Name: job_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.job_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE public.job_status OWNER TO postgres;

--
-- TOC entry 913 (class 1247 OID 39012)
-- Name: job_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.job_type AS ENUM (
    'TENANT_ONBOARDING',
    'INVOICE_SUBMISSION'
);


ALTER TYPE public.job_type OWNER TO postgres;

--
-- TOC entry 919 (class 1247 OID 39043)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'MEMBER',
    'AUDITOR'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- TOC entry 242 (class 1255 OID 47313)
-- Name: prevent_event_log_modifications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_event_log_modifications() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'event_log es append-only';
END;
$$;


ALTER FUNCTION public.prevent_event_log_modifications() OWNER TO postgres;

--
-- TOC entry 240 (class 1255 OID 47311)
-- Name: prevent_invoice_record_modifications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_invoice_record_modifications() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'invoice_record es append-only';
END;
$$;


ALTER FUNCTION public.prevent_invoice_record_modifications() OWNER TO postgres;

--
-- TOC entry 227 (class 1255 OID 39028)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 226 (class 1259 OID 47236)
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key_hash character varying(255) NOT NULL,
    key_prefix character varying(8) NOT NULL,
    tenant_id integer NOT NULL,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.api_keys OWNER TO postgres;

--
-- TOC entry 3510 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.api_keys IS 'Almacena las API Keys para la autenticación de los conectores de escritorio.';


--
-- TOC entry 221 (class 1259 OID 38971)
-- Name: dispatch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispatch (
    id integer NOT NULL,
    invoice_record_id integer,
    intento integer NOT NULL,
    ts timestamp with time zone DEFAULT now(),
    resultado character varying(50),
    http_code integer,
    error_code_aeat character varying(50),
    raw_request text
);


ALTER TABLE public.dispatch OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 38970)
-- Name: dispatch_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dispatch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispatch_id_seq OWNER TO postgres;

--
-- TOC entry 3511 (class 0 OID 0)
-- Dependencies: 220
-- Name: dispatch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dispatch_id_seq OWNED BY public.dispatch.id;


--
-- TOC entry 223 (class 1259 OID 38986)
-- Name: event_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.event_log (
    id integer NOT NULL,
    tenant_id integer,
    event_type public.event_type NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.event_log OWNER TO postgres;

--
-- TOC entry 3512 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE event_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.event_log IS 'Registro de eventos inalterable (caja negra) exigido por la normativa.';


--
-- TOC entry 222 (class 1259 OID 38985)
-- Name: event_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.event_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.event_log_id_seq OWNER TO postgres;

--
-- TOC entry 3513 (class 0 OID 0)
-- Dependencies: 222
-- Name: event_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.event_log_id_seq OWNED BY public.event_log.id;


--
-- TOC entry 219 (class 1259 OID 38952)
-- Name: invoice_record; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_record (
    id integer NOT NULL,
    tenant_id integer,
    hash_actual character varying(64) NOT NULL,
    hash_anterior character varying(64),
    tipo character varying(20) NOT NULL,
    serie character varying(50) NOT NULL,
    numero character varying(50) NOT NULL,
    fecha_emision date NOT NULL,
    emisor_nif character varying(20) NOT NULL,
    receptor_nif character varying(20),
    base_total numeric(12,2) NOT NULL,
    cuota_total numeric(12,2) NOT NULL,
    importe_total numeric(12,2) NOT NULL,
    desglose_iva jsonb,
    estado_aeat character varying(50) DEFAULT 'PENDIENTE'::character varying,
    aeat_request_id character varying(100),
    respuesta_aeat text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invoice_record_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['ALTA'::character varying, 'ANULACION'::character varying])::text[])))
);


ALTER TABLE public.invoice_record OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 38951)
-- Name: invoice_record_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoice_record_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_record_id_seq OWNER TO postgres;

--
-- TOC entry 3514 (class 0 OID 0)
-- Dependencies: 218
-- Name: invoice_record_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoice_record_id_seq OWNED BY public.invoice_record.id;


--
-- TOC entry 224 (class 1259 OID 39017)
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type public.job_type NOT NULL,
    status public.job_status DEFAULT 'PENDING'::public.job_status NOT NULL,
    payload jsonb,
    result jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.jobs OWNER TO postgres;

--
-- TOC entry 3515 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE jobs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.jobs IS 'Tabla para gestionar trabajos asíncronos procesados por n8n.';


--
-- TOC entry 217 (class 1259 OID 38939)
-- Name: tenant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant (
    id integer NOT NULL,
    nif character varying(20) NOT NULL,
    razon_social character varying(255) NOT NULL,
    modalidad character varying(20) NOT NULL,
    certificados_meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    integration_method character varying(50) DEFAULT 'API'::character varying,
    email character varying(255),
    contact_name character varying(255),
    sector character varying(255),
    CONSTRAINT tenant_modalidad_check CHECK (((modalidad)::text = ANY ((ARRAY['VERIFACTU'::character varying, 'NO_VERIFACTU'::character varying])::text[])))
);


ALTER TABLE public.tenant OWNER TO postgres;

--
-- TOC entry 3516 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN tenant.integration_method; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant.integration_method IS 'El método de integración del cliente (API, PRINTER).';


--
-- TOC entry 3517 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN tenant.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant.email IS 'Email de contacto principal del cliente.';


--
-- TOC entry 3518 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN tenant.contact_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant.contact_name IS 'Nombre de la persona de contacto.';


--
-- TOC entry 3519 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN tenant.sector; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tenant.sector IS 'Sector empresarial del cliente.';


--
-- TOC entry 216 (class 1259 OID 38938)
-- Name: tenant_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tenant_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_id_seq OWNER TO postgres;

--
-- TOC entry 3520 (class 0 OID 0)
-- Dependencies: 216
-- Name: tenant_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tenant_id_seq OWNED BY public.tenant.id;


--
-- TOC entry 225 (class 1259 OID 39049)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role public.user_role DEFAULT 'MEMBER'::public.user_role NOT NULL,
    is_active boolean DEFAULT true,
    tenant_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_reset_token character varying(255),
    reset_token_expires timestamp with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 3521 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'Almacena los usuarios individuales y sus credenciales de acceso.';


--
-- TOC entry 3522 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS 'Define los permisos del usuario: ADMIN, MEMBER, AUDITOR.';


--
-- TOC entry 3523 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN users.password_reset_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password_reset_token IS 'Token único para el proceso de reseteo de contraseña.';


--
-- TOC entry 3524 (class 0 OID 0)
-- Dependencies: 225
-- Name: COLUMN users.reset_token_expires; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.reset_token_expires IS 'Fecha y hora en la que el token de reseteo expira.';


--
-- TOC entry 3295 (class 2604 OID 38974)
-- Name: dispatch id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch ALTER COLUMN id SET DEFAULT nextval('public.dispatch_id_seq'::regclass);


--
-- TOC entry 3297 (class 2604 OID 38989)
-- Name: event_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_log ALTER COLUMN id SET DEFAULT nextval('public.event_log_id_seq'::regclass);


--
-- TOC entry 3292 (class 2604 OID 38955)
-- Name: invoice_record id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_record ALTER COLUMN id SET DEFAULT nextval('public.invoice_record_id_seq'::regclass);


--
-- TOC entry 3289 (class 2604 OID 38942)
-- Name: tenant id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant ALTER COLUMN id SET DEFAULT nextval('public.tenant_id_seq'::regclass);


--
-- TOC entry 3502 (class 0 OID 47236)
-- Dependencies: 226
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.api_keys (id, key_hash, key_prefix, tenant_id, is_active, last_used_at, created_at) FROM stdin;
293c07f7-c528-4828-9059-b5fe12209529	0a3312c7a5b759aa04a1078109b7755e5ff4a45ffacdd9faca7bedd1acbbd1e3	0c5f75f6	1	t	\N	2025-09-02 17:44:56.571157+00
4495749b-434a-4fda-92e1-2a493ac78bee	f72564cccbdffbffd9a17d2208be32fbc83623ca8513be97212bfa4b4ef31323	87359e65	1	t	\N	2025-09-02 19:56:06.058319+00
0178d1f0-310d-4836-8183-3e6a889a1891	1c58f249ff50f9afe419b104abc6c7ac3fdbd002bd03b4184eaf7dfb3fc73685	0c0002ef	1	t	\N	2025-09-01 17:17:44.568604+00
ab538522-b0cd-4105-8510-ec59b9a7f89c	c7691804c46dc7664cfea6964cbbb31f9a7422468f805244d04e3e183bda4e46	4e25e02d	1	t	\N	2025-09-01 17:29:33.285311+00
a7e9d09a-5487-447c-8a3a-5e3613e107c7	7f2a6215adcc8b960469ae6a276ac130608ed0c119e051744ca46510989d21b0	f46507fd	1	t	\N	2025-09-01 17:36:58.117623+00
fe45337b-3b00-4385-b15a-db0c7046603d	7111f6e3de7593739cefa7d184dcced6c43af5cdb6902af9b793b746f4a1c5f2	4b101ef2	1	t	\N	2025-09-01 17:40:55.937571+00
388ef7b3-b0d7-42b9-ba2b-e8b851c113cd	7d4f1c865e24068cb87e4d99434a0b578fc8111db0aa9623e37d163990876417	cc7125eb	1	t	\N	2025-09-01 20:28:19.037535+00
691077f2-4f4d-45a0-9f12-a75cc832079d	000df77cd2197cc68253d8b43c5b731cceb9453e4db9be83c2cbc8a6d0d8b5d9	424a3e48	1	t	\N	2025-09-01 20:34:32.723551+00
e0fc6dd2-4d61-4c70-907c-a2a16b3bfb20	6622a3cf5f8f6024924a5cd1fcf0d7387201bc96c614059ddc2d959d699ba990	f9b20f6d	1	t	\N	2025-09-01 21:19:33.703206+00
abb143c2-8f36-43e5-b228-c641ae4f7b02	91efc740bf37c14c170bb4bc8ae6b51b8b30f1311c5261010acc4500eab520ab	494affee	1	t	\N	2025-09-01 21:20:36.348021+00
ad10ec0a-422b-44ef-a2a8-4e22bbd002bc	682b7be32ed9e413871c517622f21b6dad08618e101c8a122e16d22151367ba3	fb2e1f95	1	t	\N	2025-09-01 21:22:56.001905+00
eaa7f283-54f8-4e84-8114-0781ce18b406	c68629d9f966c98de114d889202d3c367aed0d82349298b4c1cede55402716fa	9f38ec8e	1	t	\N	2025-09-01 21:25:03.77966+00
49b73e69-fede-4d91-a75d-0c705bb88630	19a43088ebce17765b00b8780484877813a6f98850378a51a3e4b3a5b3a527d0	4fdff82b	1	t	\N	2025-09-01 21:29:15.67158+00
cf958549-9dd1-4d11-9a5e-7661093e7ffc	b03db54b8139035a59bca41289cbc8daf0b6839f278ee93888e925af9cd14f68	ea39e089	1	t	\N	2025-09-01 21:35:41.27335+00
4386d65c-3589-43d4-8266-8397d91c8df0	7abb56be86aa76c409920ad19c0ec5d890523db9c41a157d246d4f35fb335e17	f41d5371	1	t	\N	2025-09-01 21:37:18.847667+00
0d640229-9c44-43ce-acf1-cb55aa75fca3	1e1b6a1b42f981f9547c48226d664fb51529085f782f3aa0160a17019b910ef7	7fdcb5f1	1	t	\N	2025-09-01 22:15:16.668849+00
aea5519e-946a-4c17-9440-4392ad9ff60a	dbdb40149b0abedb3d5c7b044801fcf8eedff756e336dccee72058dee6617858	09b8de12	1	t	\N	2025-09-01 22:15:21.49025+00
09d3e1fc-de66-4c85-835b-b4b51ae8b7ae	156c66929d2346d11f74f3a8eb6241e0035c7bb52d2f1da2e317faa58327bbe0	e79a4415	1	t	\N	2025-09-02 10:37:15.722244+00
6bdf7cce-8ebc-4352-9b42-3d6473a0ea9a	e07a318b543753063454a20ce66cf0e3d7996413017b13b22af189607afc9b57	fbb98913	1	t	\N	2025-09-02 10:37:37.237092+00
b717846b-648c-49ff-9a88-29c76e03c469	3f04f9181f9ddd3d32ac9980f636c741f6caacd75b5e6151d12165521c000319	49686b20	1	t	\N	2025-09-02 11:04:17.803442+00
4bc74f60-2ae7-471f-87f6-90650995a0f2	f77e3187cba8c2f692d90efa12664837825a2bc9a6be3f1f6dbfa005eceea921	a45b798f	1	t	\N	2025-09-02 12:14:48.956171+00
2f91382f-e228-479f-8cb6-8cd401164870	027e2e38da4cecc89d2d90edcf5c6a70eb72ad0fdb61b329f86af11cc43683db	d3c9f9ed	1	t	\N	2025-09-02 12:15:50.944334+00
1548286c-f820-47f3-b46d-01a63b727443	5e7a0fccbf75a48b08040b9426153e0a1932f6e1144cd6e9cc9ce5bd1dcf0a21	d0b84e14	1	t	\N	2025-09-02 14:08:16.49682+00
933bb4a6-015d-4887-8a3e-7d72f186fb18	314c6b00b8958f2c237d3db7e9166c63ae26a39ead8dd5f4114745909cea980d	b13ecf2b	1	t	\N	2025-09-02 14:08:24.855781+00
be648cda-c714-4ea0-847f-1eff2a4a0722	8596116635d1932ff1da58563a7ce7a059d62310ffe032d634b3fdb913ae2e20	44f60d7a	1	t	\N	2025-09-02 14:14:25.380488+00
bf2548b1-45f0-4e6b-83ab-dd20effc8620	1a5cdf87f27beaf8f293072c803b1089090e21a6aaeeb5e10a398bc5b1d32615	d31df09c	1	t	\N	2025-09-02 14:25:44.282454+00
129627e5-8eff-4618-b2d9-885258a8a998	f912d9b0773b74ae03fd50ae73bd76e1f9fe300bfdfbede9df25c3b34e0af35b	1ebfd84a	1	t	\N	2025-09-02 14:27:30.266451+00
cd84985a-502f-4cc7-80b6-6b20b1bc6691	e811aaca2270d1708a01977843e85f9e4abc3eac919ecbbb0523d6af58a5deee	b5d28f76	1	t	\N	2025-09-02 14:32:50.213684+00
ae7dcf73-3050-4537-a8ca-29e25ee80cf5	29aff76f1ae4ddf1c77cb9ec1a6a9892d2c780b6d0f7758dd063777ecb561a81	c63cb9bf	1	t	\N	2025-09-02 14:34:25.539045+00
a79f7beb-1cfd-4a6b-96de-295fa8b64fba	631f3f4a49702a6337b464f1cc6a76ab8ced0a6b8f3b0b75738a0a004f1adfe7	f7848c51	1	t	\N	2025-09-02 14:50:49.923526+00
133ae521-fcbf-49f8-808b-4769070d3753	bed7d7142cb08a3f838a337a172fdb004aee0f0f91938a54d8d1c714db00c67f	47c3d8e1	1	t	\N	2025-09-02 15:00:26.595099+00
f5b18796-7ef2-4c68-ab0c-d949af7d10ce	e6f8248a811d08356338e9ba3830f25c32ceb0db05d2e5492e7cd10a6fe7dcee	bfe7e2b3	1	t	\N	2025-09-02 16:55:34.19583+00
f8ba4ca1-f96c-4050-a329-9a50197d417a	4e9ab0982d9d70a2a5ebfd164145e62e006515b5f31285f78ad229a6aef52f89	ef5b7382	1	t	\N	2025-09-02 16:58:32.684309+00
1af51f3e-77f4-4b3e-b077-5013b1608336	caf867296d310d7cdf959b945d18bd5ff0203c0d4496c8261debc58b2223d9c4	c6db1734	1	t	\N	2025-09-02 17:01:26.417985+00
52ae73c7-0ebb-4ff0-a52b-f9c294e2ea4f	5918826495c089755bdaf4eec1095fa8333421eac018f4b9d3627f9c6d2604f8	36b72ff0	1	t	\N	2025-09-02 17:08:29.476474+00
d65fe42c-17cc-4d35-be72-3ba990e72d48	f602bda1b5d50e90ee822e58d663a095ff9b486b04f5851b4e15c6b999d2a88c	8b241258	1	t	\N	2025-09-02 17:08:33.686833+00
e9d72649-926b-458e-9d17-b0c27718749f	d089784210e35e033ab3c30feae974b330385c1bb74a26e13a1161255ec14534	189fd752	1	t	\N	2025-09-02 17:09:08.495952+00
ecb4141e-e9b7-4016-b751-4ed54f0917f1	7cb6ea5e27e87091e0fc4e2c99433c1dce86912c4b192dab3a9f5ef54f485039	e1f1444d	1	t	\N	2025-09-02 17:09:11.167053+00
e8b13587-0694-4f1b-a61d-36f3b5b7d7cb	403420ff35e832d6f6da826c70f893fe74e2e8d869a2cfb34021ca6d6c6a7839	b4b13628	1	t	2025-08-31 08:09:52.605+00	2025-08-21 09:09:33.863923+00
44003576-2b13-4f92-8f1d-1341f6f4ec5a	ea248c551a857dfe0d956d12422ca3ba1dee3e58d67d5410f212ba31dae59901	fe6ca762	1	t	\N	2025-09-02 19:56:08.852902+00
e72cb219-8039-4f4d-9eb4-c4ba8dfe588e	b3be33a8483fca599599db9c3a5926740493610e4bd7698c8691e740e891cdd2	a6c0ab08	1	t	\N	2025-09-02 20:19:31.400193+00
2df11ade-035a-43be-9cb7-49b889e8244c	f43865ac26b78e16d5e527c6ec6c3fc2328cf9510f404caad995818211542806	a0bd84ae	1	t	\N	2025-09-02 20:19:55.220198+00
3f9ef30d-7132-4556-bc0d-14dd5ebd360d	c188634dceb88279757ae36bd85b3bfe131dd80bec38e908f12fc21e2ff59b09	43abfc35	1	t	\N	2025-09-02 20:23:39.579321+00
26582613-8121-4192-9d9c-b454e61d818d	6e577850bea24d48740699dd4198255906eee2acb6561c8d05ace02175db96b5	de178bd2	1	t	\N	2025-09-02 21:35:46.304646+00
80cb5d2d-f5b4-473d-8af9-0a278244fd68	a3e889fdc70756635aa438b156fce4def34bc6354b0466296f8c52fa29395b41	8d20af95	1	t	\N	2025-09-02 21:44:17.350718+00
9420dd4d-7812-4da0-82a1-bae2802e7aa4	3ad8821239f5d1065a7e9906f193fb57500e7df4fe5a77bdd2de394586df443f	c878d174	1	t	\N	2025-09-02 21:52:24.439051+00
5152b55b-427c-4ff8-bacf-f0bbc76d520a	c2090ec9b42bce0b550a93c55ff549f848116be4f7ca1ea59530c9580a57af48	a44702a5	1	t	\N	2025-09-02 21:52:32.276866+00
4d2d53e4-3781-4141-ae11-de9a610c526b	4f13611f659dc7c7f504b5d7b30f93f1dfa11e143f5a4ba35ac954a173f36f71	84f4ccc5	1	t	\N	2025-09-02 21:53:21.600961+00
b45c2c4e-b679-4a55-85c2-0ccf45f4d138	123cbcdd242adc2b07aea68340f0e602f7f1af1d9a72009a526f04d0fc459294	f11f8298	1	t	\N	2025-09-02 22:12:39.827518+00
c840def5-98e7-40a7-aad7-88d77d27f3f0	c5e26dcee925a5c672f0dde1ae3b58b29fe81c4e54d8809bdfc996e4cdda6de7	9bfa3255	1	t	\N	2025-09-02 22:19:47.37096+00
558627ea-ac65-4abb-ab2a-7737164ae8fc	9c82374d5a09fb97b7ce01a3c82e1a1e9accd6a86ed0ca3f515ce05a1bf8bf76	6f23917a	1	t	\N	2025-09-02 22:25:04.915565+00
89d9fcdb-ec48-4a23-9e8d-97867f92520d	371186ab1798de7b40723141382f2793fe43896739b94519ac45ab64e0af8c64	1ca829ae	1	t	\N	2025-09-02 22:28:04.912459+00
11b66a0b-1b7a-4421-91b0-9ec77f19da0e	b72b32d04d275b259fa2c76b17dcaf62d41592aa02ea2a83e401e9fa9d9542c9	c0d7c3ea	1	t	\N	2025-09-02 22:29:06.508828+00
ac57fa55-3aad-4662-bf13-04b5bf10c46c	e774bd5f00b9abc5a9516e47011185c2d4cf9db1ca15bb9c8e33fe758a74e8c3	592ac639	1	t	\N	2025-09-03 09:06:58.410069+00
4b239eec-4467-4c92-80e2-7a263579cab2	3b64889349374befffb649bb00db49c707887c53ef16ced2926ac79b7346fb95	c57518fc	1	t	\N	2025-09-03 09:10:16.539627+00
b0754ad9-98bb-43ad-8444-ddc08d6a9707	6cde46b8bcef8e39ee0a99b33194c435f42186e08dad8784701b55f01db34f61	3ca46a80	1	t	\N	2025-09-03 09:10:36.53803+00
0c4acd97-2b5d-4fe6-ba01-5105b3e302e5	e87365366a2d8b0e65ea3d7c9c53b2d9e58756f1a453040d64785ad2a86ed35c	b5d30721	1	t	\N	2025-09-03 09:39:06.832713+00
4b009448-79b6-4510-8c43-91a89b119427	57034b3fabcd5f677f3f5e5e33e8849de56480e31c1547633be934583cda73af	50da6bbe	1	t	\N	2025-09-03 10:38:17.803234+00
0afeac3e-2fec-4d0e-a426-9f01443cc9d7	8354cfe4f6618c678b2d7ba6cf259601e057cc1b6118bb9a4c74c9ea29447e64	64a4e652	1	t	\N	2025-09-03 11:02:14.764279+00
126f08f0-d895-444d-95a1-9ff8e2adc47b	c6632528c381a1952c09126416539595f78f5117ab78a35185250c4227e72844	0e766a41	1	t	\N	2025-09-03 11:16:47.807815+00
9989b8ab-78ef-4f37-bde1-568089bf388a	ca901baa7760e769d667c711e17a636654f6e86b2ef4bde97060064685ca718a	ba8da38e	1	t	\N	2025-09-03 11:57:13.600878+00
120c49e5-7651-4fd9-8900-f1a21a917cf3	c2c6eb09230d50455387fa93ee807861f81c82154424fa88da44dabddb625d35	7a932025	1	t	\N	2025-09-03 13:43:23.188857+00
12cdff10-2252-43a2-bf21-10203057b958	197748c88a774b3a7ce6d77f88ddc7241bdfd870fdf4fe0c84cfb40b46a8d533	b355bb49	1	t	\N	2025-09-03 14:26:35.050807+00
dab0e47c-97b1-43f7-9644-fef606493329	38dcbd70aa149360806200cccfac1cc0f304e5f74ac5d5ca98769aabc70a8ebd	115d84f6	1	t	\N	2025-09-03 14:43:38.468393+00
fcedf0b5-e624-45b7-a546-b46f54d61f71	a3fef9135b01cfe7d86d33d1bb0be1ca3b391045ace84e480effab37206be073	5e58cc00	1	t	\N	2025-09-03 16:45:12.046737+00
446a1b57-5d6a-486c-9d72-a07acbb3b1f9	68d3b49b7102c405123ef92cf31ceb4a2e4a01d87f3b6ec62761c6b9d6ffff0d	17e068ec	1	t	\N	2025-09-03 17:18:42.313821+00
ee4b0842-1332-4e8c-a3d0-90de77e1c740	57d3e8ee42c649ba5a6ec6c921ee88234ea355ba1e7480f0033dfc8bb6e5d922	901e0ed0	1	t	\N	2025-09-03 17:21:46.838915+00
78eb6591-207f-469f-829e-20625ea966f1	ac781553f2f816ecfaea780e87cdc0db3d0e62df792b3f3688d4334ebccac27b	e51635d9	1	t	\N	2025-09-03 17:36:04.805015+00
48025178-7aca-4c68-99bf-ec4ef7063e82	f4eac9a0b0e8faa8994a90175afdddf7d6beeff280fef5ea2bb62299ff513cd9	e3247f3c	1	t	\N	2025-09-03 17:36:20.024534+00
84d1a948-f9af-48ac-8b44-427f71e3db9a	00f1065a766f69b9a7fa2392409556f0d718e63e1b8e8beba16a1e55f264b978	dec465df	1	t	\N	2025-09-03 17:37:41.929798+00
6f50c8f1-62e4-4c88-ae34-625f43187469	4725708ca2f126374adf8458b11bc8931da92f3aacf6e7d8791e780bf32b7e0a	dd6ee980	1	t	\N	2025-09-03 18:47:49.167488+00
6f73ae6a-16dd-43be-a206-7ab54912ce39	d8e49ed989c1554e6fca57e15fe2e5cd0f6118fd3135475fa623736073b81cf6	92492686	1	t	\N	2025-09-03 18:48:59.753238+00
f8cb07dc-737e-45ad-9136-f89b2ac5ff5f	cc04d10441ab39877527cdcd5a10f99a684fee7750a852b6ad0d4f3618cde042	f1700c64	1	t	\N	2025-09-03 20:00:47.855244+00
e12de901-0fee-43fa-9f8e-c9b4aaa363f3	2071a67b08c173f344fa2d407dd5e0a57414a66fd38d47f7c3e763e0ac741886	352bc13d	1	t	\N	2025-09-03 20:00:50.104847+00
40941ec9-7f27-4bb2-86e7-706284ca96fd	d7de0b2d00d23679714744c2d7ed11e65ca15fad7154fbbee4c0cbafb98898bb	7c921dc9	1	t	\N	2025-09-05 08:40:58.041684+00
\.


--
-- TOC entry 3497 (class 0 OID 38971)
-- Dependencies: 221
-- Data for Name: dispatch; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispatch (id, invoice_record_id, intento, ts, resultado, http_code, error_code_aeat, raw_request) FROM stdin;
\.


--
-- TOC entry 3499 (class 0 OID 38986)
-- Dependencies: 223
-- Data for Name: event_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.event_log (id, tenant_id, event_type, details, created_at) FROM stdin;
2	1	APP_START	{}	2025-08-22 18:38:11.024+00
3	1	APP_START	{}	2025-08-22 18:42:51.632+00
4	1	APP_START	{}	2025-08-22 18:50:20.466+00
5	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0014", "emisorNif": "09388720m", "invoiceId": 42, "hashActual": "F58691779B5D5FBE8C79D6A0417099A1C23537C1B3C15AAE0F11F6C5874FB85A", "aeatResponse": {"status": "COMPLETED", "response": {"codigo": "00", "mensaje": "Aceptada por AEAT (mock)"}}}	2025-08-29 12:37:44.132545+00
6	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0017", "emisorNif": "09388720m", "invoiceId": 44, "hashActual": "86621313480DCF059E074971C4A0E87644409E6C52624A54E9E9A2288063ED37", "aeatResponse": {"hashActual": "86621313480DCF059E074971C4A0E87644409E6C52624A54E9E9A2288063ED37", "invoiceRecordId": 44}}	2025-08-29 13:31:52.245804+00
7	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0017", "emisorNif": "09388720m", "invoiceId": 44, "hashActual": "86621313480DCF059E074971C4A0E87644409E6C52624A54E9E9A2288063ED37", "aeatResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	2025-08-29 13:31:52.426429+00
8	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0019", "emisorNif": "09388720m", "invoiceId": 45, "hashActual": "491B3486E4A6B5EB230CA49CAA0E91EC0B282A4C6A5F1CAD05C67CA5AE2F723A", "aeatResponse": {"hashActual": "491B3486E4A6B5EB230CA49CAA0E91EC0B282A4C6A5F1CAD05C67CA5AE2F723A", "invoiceRecordId": 45}}	2025-08-29 18:21:28.395073+00
9	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0018", "emisorNif": "09388720m", "invoiceId": 46, "hashActual": "01B4717B30F0FCEE070F2BACC11C41257B888466400A7D630B421049329A77BC", "aeatResponse": {"hashActual": "01B4717B30F0FCEE070F2BACC11C41257B888466400A7D630B421049329A77BC", "invoiceRecordId": 46}}	2025-08-29 19:03:39.487143+00
10	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0016", "emisorNif": "09388720m", "invoiceId": 47, "hashActual": "FBA299D16C46C09B03C8CB12D5A784A7CDB90998C19D9FFFC83C3426CC17983E", "aeatResponse": {"hashActual": "FBA299D16C46C09B03C8CB12D5A784A7CDB90998C19D9FFFC83C3426CC17983E", "invoiceRecordId": 47}}	2025-08-29 19:06:24.941704+00
11	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0016", "emisorNif": "09388720m", "invoiceId": 51, "hashActual": "210CCEAD98F650C530EF0C02C71022FD264E113ACF44562C8C17E5902440FDA2", "aeatResponse": {"hashActual": "210CCEAD98F650C530EF0C02C71022FD264E113ACF44562C8C17E5902440FDA2", "invoiceRecordId": 51}}	2025-08-31 07:31:23.167219+00
12	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0017", "emisorNif": "09388720m", "invoiceId": 52, "hashActual": "264C80C97D37942C0CDC8A37030CC8C8E4D847ADEA8962B75073934DF6455F0B", "aeatResponse": {"hashActual": "264C80C97D37942C0CDC8A37030CC8C8E4D847ADEA8962B75073934DF6455F0B", "invoiceRecordId": 52}}	2025-08-31 07:50:42.447546+00
13	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0015", "emisorNif": "09388720m", "invoiceId": 53, "hashActual": "29A4D48D6C617417037FFD9B31AEBF100F26B6FD62C757B500BC8E60C48C72FC", "aeatResponse": {"hashActual": "29A4D48D6C617417037FFD9B31AEBF100F26B6FD62C757B500BC8E60C48C72FC", "invoiceRecordId": 53}}	2025-08-31 08:06:56.176783+00
14	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0018", "emisorNif": "09388720m", "invoiceId": 54, "hashActual": "CEC366B6269EF58098BA797CFC998D3F265D91AF1B3AE384BC2B79939121EF6C", "aeatResponse": {"hashActual": "CEC366B6269EF58098BA797CFC998D3F265D91AF1B3AE384BC2B79939121EF6C", "invoiceRecordId": 54}}	2025-08-31 08:09:51.241791+00
15	1	AEAT_CONFIRMED	{"serie": "F5FE54DC", "numero": "0018", "emisorNif": "09388720m", "invoiceId": 54, "hashActual": "CEC366B6269EF58098BA797CFC998D3F265D91AF1B3AE384BC2B79939121EF6C", "aeatResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	2025-08-31 08:09:52.571298+00
16	\N	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "c79c2fda-0434-4969-9e19-ce1740974105", "keyPrefix": "72b13535"}	2025-08-31 21:38:03.709239+00
17	\N	CONFIG_UPDATE	{"action": "API_KEY_REVOKED", "apiKeyId": "c79c2fda-0434-4969-9e19-ce1740974105", "keyPrefix": "72b13535"}	2025-08-31 21:39:14.024855+00
18	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ff533039-3e5d-44f5-b6f7-34a318642614", "keyPrefix": "d35c2397"}	2025-08-31 21:52:42.338758+00
19	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ab538522-b0cd-4105-8510-ec59b9a7f89c", "keyPrefix": "4e25e02d"}	2025-09-01 17:29:33.310429+00
20	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "a7e9d09a-5487-447c-8a3a-5e3613e107c7", "keyPrefix": "f46507fd"}	2025-09-01 17:36:58.142978+00
21	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 17:36:58.161371+00
22	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "fe45337b-3b00-4385-b15a-db0c7046603d", "keyPrefix": "4b101ef2"}	2025-09-01 17:40:55.946143+00
23	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 17:40:55.952478+00
24	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "388ef7b3-b0d7-42b9-ba2b-e8b851c113cd", "keyPrefix": "cc7125eb"}	2025-09-01 20:28:19.056769+00
25	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 20:28:19.075742+00
26	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "691077f2-4f4d-45a0-9f12-a75cc832079d", "keyPrefix": "424a3e48"}	2025-09-01 20:34:32.745618+00
27	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 20:34:32.763165+00
28	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "e0fc6dd2-4d61-4c70-907c-a2a16b3bfb20", "keyPrefix": "f9b20f6d"}	2025-09-01 21:19:33.724879+00
29	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:19:33.735284+00
30	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "abb143c2-8f36-43e5-b228-c641ae4f7b02", "keyPrefix": "494affee"}	2025-09-01 21:20:36.374079+00
31	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:20:36.391181+00
32	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ad10ec0a-422b-44ef-a2a8-4e22bbd002bc", "keyPrefix": "fb2e1f95"}	2025-09-01 21:22:56.024084+00
33	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:22:56.032347+00
34	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "eaa7f283-54f8-4e84-8114-0781ce18b406", "keyPrefix": "9f38ec8e"}	2025-09-01 21:25:03.830005+00
35	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:25:03.836659+00
36	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "49b73e69-fede-4d91-a75d-0c705bb88630", "keyPrefix": "4fdff82b"}	2025-09-01 21:29:15.692024+00
37	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:29:15.701506+00
38	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "cf958549-9dd1-4d11-9a5e-7661093e7ffc", "keyPrefix": "ea39e089"}	2025-09-01 21:35:41.298855+00
39	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:35:41.315081+00
40	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "4386d65c-3589-43d4-8266-8397d91c8df0", "keyPrefix": "f41d5371"}	2025-09-01 21:37:26.018222+00
41	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 21:37:28.668571+00
42	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "aea5519e-946a-4c17-9440-4392ad9ff60a", "keyPrefix": "09b8de12"}	2025-09-01 22:15:21.512208+00
43	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-01 22:15:21.528235+00
44	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "09d3e1fc-de66-4c85-835b-b4b51ae8b7ae", "keyPrefix": "e79a4415"}	2025-09-02 10:37:15.759857+00
45	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 10:37:15.806714+00
46	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "6bdf7cce-8ebc-4352-9b42-3d6473a0ea9a", "keyPrefix": "fbb98913"}	2025-09-02 10:37:37.261429+00
47	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 10:37:37.273903+00
48	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "b717846b-648c-49ff-9a88-29c76e03c469", "keyPrefix": "49686b20"}	2025-09-02 11:04:17.857941+00
49	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 11:04:17.864646+00
50	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "4bc74f60-2ae7-471f-87f6-90650995a0f2", "keyPrefix": "a45b798f"}	2025-09-02 12:14:48.991177+00
51	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 12:14:49.008122+00
52	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "2f91382f-e228-479f-8cb6-8cd401164870", "keyPrefix": "d3c9f9ed"}	2025-09-02 12:15:50.968191+00
53	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 12:15:50.975278+00
54	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "933bb4a6-015d-4887-8a3e-7d72f186fb18", "keyPrefix": "b13ecf2b"}	2025-09-02 14:08:24.873613+00
55	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:08:24.891435+00
56	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "be648cda-c714-4ea0-847f-1eff2a4a0722", "keyPrefix": "44f60d7a"}	2025-09-02 14:14:25.404392+00
57	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:14:25.41315+00
58	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "bf2548b1-45f0-4e6b-83ab-dd20effc8620", "keyPrefix": "d31df09c"}	2025-09-02 14:25:44.347953+00
59	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:25:44.373717+00
60	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "129627e5-8eff-4618-b2d9-885258a8a998", "keyPrefix": "1ebfd84a"}	2025-09-02 14:27:30.308635+00
61	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:27:30.319096+00
62	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "cd84985a-502f-4cc7-80b6-6b20b1bc6691", "keyPrefix": "b5d28f76"}	2025-09-02 14:32:50.244722+00
63	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:32:50.255209+00
64	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ae7dcf73-3050-4537-a8ca-29e25ee80cf5", "keyPrefix": "c63cb9bf"}	2025-09-02 14:34:25.564152+00
65	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:34:25.581656+00
66	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "a79f7beb-1cfd-4a6b-96de-295fa8b64fba", "keyPrefix": "f7848c51"}	2025-09-02 14:50:49.96359+00
67	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 14:50:49.972633+00
68	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "133ae521-fcbf-49f8-808b-4769070d3753", "keyPrefix": "47c3d8e1"}	2025-09-02 15:00:26.627642+00
69	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 15:00:26.645784+00
70	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "f5b18796-7ef2-4c68-ab0c-d949af7d10ce", "keyPrefix": "bfe7e2b3"}	2025-09-02 16:55:34.221179+00
71	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 16:55:34.228411+00
72	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "f8ba4ca1-f96c-4050-a329-9a50197d417a", "keyPrefix": "ef5b7382"}	2025-09-02 16:58:32.708432+00
73	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 16:58:32.748407+00
74	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "1af51f3e-77f4-4b3e-b077-5013b1608336", "keyPrefix": "c6db1734"}	2025-09-02 17:01:26.427666+00
75	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 17:01:26.439357+00
76	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "d65fe42c-17cc-4d35-be72-3ba990e72d48", "keyPrefix": "8b241258"}	2025-09-02 17:08:33.705729+00
77	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 17:08:33.715433+00
78	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ecb4141e-e9b7-4016-b751-4ed54f0917f1", "keyPrefix": "e1f1444d"}	2025-09-02 17:09:11.185951+00
79	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 17:09:11.1921+00
80	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "44003576-2b13-4f92-8f1d-1341f6f4ec5a", "keyPrefix": "fe6ca762"}	2025-09-02 19:56:08.883446+00
81	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 19:56:08.91226+00
82	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "e72cb219-8039-4f4d-9eb4-c4ba8dfe588e", "keyPrefix": "a6c0ab08"}	2025-09-02 20:19:31.440839+00
83	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 20:19:31.459356+00
84	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "2df11ade-035a-43be-9cb7-49b889e8244c", "keyPrefix": "a0bd84ae"}	2025-09-02 20:19:55.244218+00
85	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 20:19:55.256112+00
86	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "3f9ef30d-7132-4556-bc0d-14dd5ebd360d", "keyPrefix": "43abfc35"}	2025-09-02 20:23:39.59354+00
87	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 20:23:39.606294+00
88	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "26582613-8121-4192-9d9c-b454e61d818d", "keyPrefix": "de178bd2"}	2025-09-02 21:35:46.345947+00
89	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 21:35:46.366371+00
90	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "80cb5d2d-f5b4-473d-8af9-0a278244fd68", "keyPrefix": "8d20af95"}	2025-09-02 21:44:17.384754+00
91	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 21:44:17.395576+00
92	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "5152b55b-427c-4ff8-bacf-f0bbc76d520a", "keyPrefix": "a44702a5"}	2025-09-02 21:52:32.310565+00
93	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 21:52:32.330345+00
94	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "4d2d53e4-3781-4141-ae11-de9a610c526b", "keyPrefix": "84f4ccc5"}	2025-09-02 21:53:21.629999+00
95	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 21:53:21.638727+00
96	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "b45c2c4e-b679-4a55-85c2-0ccf45f4d138", "keyPrefix": "f11f8298"}	2025-09-02 22:12:39.86232+00
97	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 22:12:39.87142+00
98	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "c840def5-98e7-40a7-aad7-88d77d27f3f0", "keyPrefix": "9bfa3255"}	2025-09-02 22:19:47.391364+00
99	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 22:19:47.402289+00
100	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "558627ea-ac65-4abb-ab2a-7737164ae8fc", "keyPrefix": "6f23917a"}	2025-09-02 22:25:04.939104+00
101	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 22:25:04.957287+00
102	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "89d9fcdb-ec48-4a23-9e8d-97867f92520d", "keyPrefix": "1ca829ae"}	2025-09-02 22:28:04.933462+00
103	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 22:28:04.944678+00
104	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "11b66a0b-1b7a-4421-91b0-9ec77f19da0e", "keyPrefix": "c0d7c3ea"}	2025-09-02 22:29:06.680462+00
105	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-02 22:29:06.783868+00
106	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ac57fa55-3aad-4662-bf13-04b5bf10c46c", "keyPrefix": "592ac639"}	2025-09-03 09:06:58.484236+00
107	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 09:06:58.569889+00
108	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "4b239eec-4467-4c92-80e2-7a263579cab2", "keyPrefix": "c57518fc"}	2025-09-03 09:10:16.557546+00
109	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 09:10:16.571866+00
110	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "b0754ad9-98bb-43ad-8444-ddc08d6a9707", "keyPrefix": "3ca46a80"}	2025-09-03 09:10:36.554466+00
111	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 09:10:36.566041+00
112	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "0c4acd97-2b5d-4fe6-ba01-5105b3e302e5", "keyPrefix": "b5d30721"}	2025-09-03 09:39:06.870089+00
113	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 09:39:06.88593+00
114	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "4b009448-79b6-4510-8c43-91a89b119427", "keyPrefix": "50da6bbe"}	2025-09-03 10:38:17.847237+00
115	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 10:38:17.86529+00
116	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "0afeac3e-2fec-4d0e-a426-9f01443cc9d7", "keyPrefix": "64a4e652"}	2025-09-03 11:02:14.798065+00
117	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 11:02:14.815143+00
118	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "126f08f0-d895-444d-95a1-9ff8e2adc47b", "keyPrefix": "0e766a41"}	2025-09-03 11:16:47.851727+00
119	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 11:16:47.871598+00
120	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "9989b8ab-78ef-4f37-bde1-568089bf388a", "keyPrefix": "ba8da38e"}	2025-09-03 11:57:13.627281+00
121	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 11:57:13.639308+00
122	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "120c49e5-7651-4fd9-8900-f1a21a917cf3", "keyPrefix": "7a932025"}	2025-09-03 13:43:23.227921+00
123	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 13:43:23.253481+00
124	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "12cdff10-2252-43a2-bf21-10203057b958", "keyPrefix": "b355bb49"}	2025-09-03 14:26:35.082639+00
125	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 14:26:35.102715+00
126	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "dab0e47c-97b1-43f7-9644-fef606493329", "keyPrefix": "115d84f6"}	2025-09-03 14:43:38.495617+00
127	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 14:43:38.514031+00
128	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "fcedf0b5-e624-45b7-a546-b46f54d61f71", "keyPrefix": "5e58cc00"}	2025-09-03 16:45:12.088057+00
129	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 16:45:12.118616+00
130	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "446a1b57-5d6a-486c-9d72-a07acbb3b1f9", "keyPrefix": "17e068ec"}	2025-09-03 17:18:42.341513+00
131	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED"}	2025-09-03 17:18:42.357956+00
132	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "ee4b0842-1332-4e8c-a3d0-90de77e1c740", "keyPrefix": "901e0ed0"}	2025-09-03 17:21:46.861898+00
133	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 17:21:49.093837+00
134	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "78eb6591-207f-469f-829e-20625ea966f1", "keyPrefix": "e51635d9"}	2025-09-03 17:36:04.821386+00
135	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 17:36:07.176661+00
136	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "48025178-7aca-4c68-99bf-ec4ef7063e82", "keyPrefix": "e3247f3c"}	2025-09-03 17:36:20.036897+00
137	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 17:36:22.363825+00
138	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "84d1a948-f9af-48ac-8b44-427f71e3db9a", "keyPrefix": "dec465df"}	2025-09-03 17:37:41.955674+00
139	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 17:37:44.42901+00
140	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "6f50c8f1-62e4-4c88-ae34-625f43187469", "keyPrefix": "dd6ee980"}	2025-09-03 18:47:49.194299+00
141	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 18:47:51.530495+00
142	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "6f73ae6a-16dd-43be-a206-7ab54912ce39", "keyPrefix": "92492686"}	2025-09-03 18:48:59.762617+00
143	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 18:49:02.128215+00
144	1	CONFIG_UPDATE	{"action": "API_KEY_CREATED", "apiKeyId": "e12de901-0fee-43fa-9f8e-c9b4aaa363f3", "keyPrefix": "352bc13d"}	2025-09-03 20:00:50.118848+00
145	1	CONFIG_UPDATE	{"action": "CONNECTOR_PACKAGE_GENERATED", "ticket": true}	2025-09-03 20:00:52.647305+00
\.


--
-- TOC entry 3495 (class 0 OID 38952)
-- Dependencies: 219
-- Data for Name: invoice_record; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_record (id, tenant_id, hash_actual, hash_anterior, tipo, serie, numero, fecha_emision, emisor_nif, receptor_nif, base_total, cuota_total, importe_total, desglose_iva, estado_aeat, aeat_request_id, respuesta_aeat, created_at) FROM stdin;
51	1	210CCEAD98F650C530EF0C02C71022FD264E113ACF44562C8C17E5902440FDA2	0000000000000000000000000000000000000000000000000000000000000000	ALTA	F5FE54DC	0016	2024-09-15	09388720m	B40604191	20.00	4.20	24.20	[{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Sep 15 - Oct 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}]	PENDING	\N	\N	2025-08-31 07:31:23.093099+00
52	1	264C80C97D37942C0CDC8A37030CC8C8E4D847ADEA8962B75073934DF6455F0B	210CCEAD98F650C530EF0C02C71022FD264E113ACF44562C8C17E5902440FDA2	ALTA	F5FE54DC	0017	2024-10-15	09388720m	B40604191	20.00	4.20	24.20	[{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Oct 15 - Nov 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}]	PENDING	\N	\N	2025-08-31 07:50:42.35829+00
53	1	29A4D48D6C617417037FFD9B31AEBF100F26B6FD62C757B500BC8E60C48C72FC	264C80C97D37942C0CDC8A37030CC8C8E4D847ADEA8962B75073934DF6455F0B	ALTA	F5FE54DC	0015	2024-08-15	09388720m	B40604191	20.00	4.20	24.20	[{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Aug 15 - Sep 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}]	PENDING	\N	\N	2025-08-31 08:06:56.131387+00
54	1	CEC366B6269EF58098BA797CFC998D3F265D91AF1B3AE384BC2B79939121EF6C	29A4D48D6C617417037FFD9B31AEBF100F26B6FD62C757B500BC8E60C48C72FC	ALTA	F5FE54DC	0018	2024-11-15	09388720m	ESB40604191	20.00	4.20	24.20	[{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Nov 15 - Dec 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}]	PENDING	\N	\N	2025-08-31 08:09:51.176124+00
\.


--
-- TOC entry 3500 (class 0 OID 39017)
-- Dependencies: 224
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jobs (id, type, status, payload, result, error_message, created_at, updated_at) FROM stdin;
9245ea47-a818-434a-9557-e094f8721698	TENANT_ONBOARDING	PENDING	{"nif": "B98765432", "modalidad": "VERIFACTU", "razonSocial": "Empresa Asíncrona SL"}	\N	\N	2025-08-13 12:54:25.829895+00	2025-08-13 12:54:25.829895+00
66899aed-349e-4d1b-a37a-1f3b5221a24a	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-13 13:48:18.91793+00	2025-08-13 13:48:19.120647+00
6dc75260-b6a0-4caf-ab49-7a2f3d1c7999	TENANT_ONBOARDING	PENDING	\N	\N	\N	2025-08-13 13:48:19.180451+00	2025-08-13 13:48:19.180451+00
8b5e4763-fa77-4e8c-9a4f-4d489e2d9a07	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-13 13:57:47.7581+00	2025-08-13 13:57:47.885169+00
ad7f0da9-6682-4479-83c6-51f76499e027	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-13 14:23:02.734752+00	2025-08-13 14:23:02.876402+00
818ebccb-e998-467e-b710-ce3c2e18038d	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "Mrcompa Peluquería"}	\N	\N	2025-08-13 14:37:46.577821+00	2025-08-13 14:37:46.737064+00
ed64c4e2-f352-4600-b7bc-a619d3c27e18	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescadería"}	\N	\N	2025-08-13 14:42:03.35676+00	2025-08-13 14:42:03.486496+00
ee43e7b0-3131-46e2-ba05-4604a2e459d3	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescados"}	\N	\N	2025-08-13 17:07:57.385454+00	2025-08-13 17:07:57.544001+00
be4a4074-dde9-443f-b101-a161b8806e6b	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescados"}	\N	\N	2025-08-13 17:10:02.80544+00	2025-08-13 17:10:02.923874+00
0b05604a-0dc1-4d92-8dc5-b35fae41a62e	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 14:17:14.655424+00	2025-08-14 14:17:18.404312+00
018cee92-9aff-4998-896e-e33d987f4276	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescados"}	\N	\N	2025-08-13 17:13:23.176583+00	2025-08-13 17:13:23.360612+00
93e61b47-fb08-44f7-9e06-9d97de930ede	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescados"}	\N	\N	2025-08-13 17:18:49.192187+00	2025-08-13 17:18:49.315221+00
d67690bf-0234-4043-a249-6cc797270a72	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescados"}	\N	\N	2025-08-13 17:23:16.140407+00	2025-08-13 17:23:16.279561+00
49de1daf-8573-4d02-9bb4-8fc0059be6cb	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa carnes"}	\N	\N	2025-08-13 17:30:13.979461+00	2025-08-13 17:30:14.119935+00
3d5f62da-5d4f-4d6f-91f2-4bd09ea2660e	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescados"}	\N	\N	2025-08-13 17:33:36.005556+00	2025-08-13 17:33:36.150906+00
020c3a10-bca6-4465-9d31-810012317ab8	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pan"}	\N	\N	2025-08-13 19:39:26.914771+00	2025-08-13 19:39:27.090964+00
9dc82e28-2d89-4ed2-9edd-4cf49e839531	TENANT_ONBOARDING	PENDING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrc pan"}	\N	\N	2025-08-13 19:53:38.630285+00	2025-08-13 19:53:38.630285+00
3c4e2e24-27bc-4886-b5f6-203a8c117ceb	TENANT_ONBOARDING	PENDING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrc pan"}	\N	\N	2025-08-13 19:55:25.881771+00	2025-08-13 19:55:25.881771+00
f06d5b45-9537-464d-a776-633fcb56abe6	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrc pan"}	\N	\N	2025-08-13 20:00:35.079695+00	2025-08-13 20:00:35.238552+00
61cba49b-1651-41a6-8efc-a00db309e42c	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrc pan"}	\N	\N	2025-08-13 20:03:21.038589+00	2025-08-13 20:03:21.173321+00
ee7c4a2f-363e-453a-982b-d76dc4406e69	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrc pan"}	\N	\N	2025-08-13 20:06:29.000312+00	2025-08-13 20:06:29.183594+00
ba75101b-fb8b-4435-b890-ce0a206bc550	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "modalidad": "VERIFACTU", "razonSocial": "mrc pescado"}	\N	\N	2025-08-13 20:10:08.843801+00	2025-08-13 20:10:08.977745+00
e44eeea7-9832-46e1-b670-c158cf61cd5c	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-14 10:05:06.482121+00	2025-08-14 10:05:06.877878+00
0a09a28e-e5e6-4ce0-9e0d-aa50a43a79fd	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa pescado"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-13 21:20:24.055937+00	2025-08-13 21:20:24.358455+00
6e86e312-6f0e-4df3-a90c-b66399a5c4db	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-14 08:52:16.039176+00	2025-08-14 08:52:16.876872+00
db8fa3e0-aafe-4904-bee0-674f9e2d0c3a	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Comercio Minorista", "modalidad": "VERIFACTU", "razonSocial": "mrcompa@gmail.com"}	\N	\N	2025-08-14 12:08:32.430895+00	2025-08-14 12:08:44.459478+00
b7bf9cbc-45b6-44d8-998d-32b1b39bc652	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-14 10:17:59.350607+00	2025-08-14 10:17:59.642416+00
a71cec81-52d6-4806-ba8d-37294fb002e8	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-14 10:28:20.327038+00	2025-08-14 10:28:20.608485+00
a4896c11-3d8f-449d-aa85-c8d2933138db	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 10:31:47.411384+00	2025-08-14 10:31:47.554239+00
d60ee8b7-a7f9-4651-96ab-7a3681d0fa94	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa   "}	\N	\N	2025-08-14 10:37:40.223734+00	2025-08-14 10:37:40.383052+00
9be26f63-91e4-48e9-a6d6-5967345331b4	TENANT_ONBOARDING	PROCESSING	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 10:44:08.861719+00	2025-08-14 10:44:09.004728+00
cb4cbb8f-ff4f-4254-b11b-74771adc148e	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 12:35:43.610583+00	2025-08-14 12:35:46.217251+00
4a2ccc95-0c67-4989-b92d-2aedeba644a7	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Tecnología", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 12:21:05.021139+00	2025-08-14 12:21:08.251649+00
33d17899-21f0-4c3d-a09e-ec0ed339a911	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Servicios Profesionales", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 12:28:08.65293+00	2025-08-14 12:28:11.295222+00
b921a601-4fc2-4733-894f-97de96cb71e5	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 13:04:52.862439+00	2025-08-14 13:04:55.73061+00
c8970c8f-6a91-4da7-a53c-6a9525f19615	TENANT_ONBOARDING	FAILED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-14 13:02:59.322965+00	2025-08-14 13:02:59.654372+00
afe38bb1-4433-44e2-8e74-c33fab879e6e	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 14:20:33.92665+00	2025-08-14 14:20:38.224081+00
c25d270b-4903-41d2-bdc5-fe038081ae55	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 16:55:44.829915+00	2025-08-14 16:55:48.653631+00
6bbea588-9561-433f-8d98-e6a97836ebb8	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Otro", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 17:02:45.876112+00	2025-08-14 17:02:50.969089+00
bbba392d-f126-427d-9bf2-bb79d692e1b2	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Comercio Minorista", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 17:24:58.19658+00	2025-08-14 17:25:02.153482+00
7611bb11-0ecd-4519-9b65-84c713d4d55a	TENANT_ONBOARDING	PENDING	{"ping": "pong"}	\N	\N	2025-08-24 21:39:54.112942+00	2025-08-24 21:39:54.112942+00
21212356-631c-4fc3-8dcc-00dcca0033f9	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "mrcompa"}	\N	\N	2025-08-14 19:51:02.924657+00	2025-08-14 19:51:08.821252+00
1d49df0b-d3ec-43d8-8704-88aaad0ddaae	INVOICE_SUBMISSION	PENDING	{"serie": "F-EXT", "lineas": [{"iva": 0, "desc": "Consultoría Internacional", "precio": 2500}], "numero": "2025-0001", "totales": {"iva": 0, "base": 2500, "total": 2500}, "receptor": {"nombre": "Global Tech Inc.", "idFiscal": "DE123456789", "codigoPais": "DE"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	\N	\N	2025-08-15 08:57:03.832353+00	2025-08-15 08:57:03.832353+00
f628a564-b016-46cd-9066-8d7acbc91718	INVOICE_SUBMISSION	PROCESSING	{"serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-9999", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	\N	\N	2025-08-15 10:01:45.464794+00	2025-08-15 10:02:29.780157+00
b5864147-6f67-4a45-b448-8f57b8f10bed	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-9999", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	\N	\N	2025-08-15 11:32:38.489913+00	2025-08-15 11:32:57.283446+00
b3efed4f-72b8-465c-aa1d-a83fde1f5338	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99991", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	\N	\N	2025-08-15 11:39:21.993057+00	2025-08-15 11:39:38.879435+00
bb267722-6f34-4c8d-ac8e-e3d452eb7037	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99992", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	\N	\N	2025-08-15 11:40:37.78253+00	2025-08-15 11:40:51.99789+00
20fe55ba-c23f-4356-9d8b-8ad16024ba14	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99997", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	"=[object Object]"	\N	2025-08-15 12:38:44.528072+00	2025-08-15 12:39:22.79527+00
22e6c263-4b03-444b-bd2d-95bed96f6cfd	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99993", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	"{ \\"invoiceRecordId\\": , \\"connectorResponse\\":  }"	\N	2025-08-15 12:22:59.770465+00	2025-08-15 12:23:15.437281+00
b9f2288c-0219-4829-a62d-e0e81e9992a3	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99995", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	"{\\n  \\"invoiceRecordId\\": 15,\\n  \\"connectorResponse\\":[object Object]\\n}"	\N	2025-08-15 12:31:31.408161+00	2025-08-15 12:31:50.356174+00
de500e8a-169c-42d3-88ce-2a4932038365	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99994", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	"{\\n  \\"invoiceRecordId\\": ,\\n  \\"connectorResponse\\": \\n}"	\N	2025-08-15 12:26:56.257584+00	2025-08-15 12:27:19.604909+00
8d9002a5-ba22-4c0f-8804-bb97fb5697e3	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99996", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	"{\\n  \\"invoiceRecordId\\": 16,\\n  \\"connectorResponse\\":{\\"Respuesta\\":{\\"CSV\\":\\"CSV_SIMULADO_123456789\\",\\"DatosPresentacion\\":{\\"NIFPresentador\\":\\"B12345678\\",\\"TimestampPresentacion\\":\\"12-08-2025 16:30:00\\"},\\"Cabecera\\":{\\"IDVersionSii\\":\\"1.0\\",\\"Titular\\":{\\"NombreRazon\\":\\"ACME SL\\",\\"NIF\\":\\"B12345678\\"}},\\"Estado\\":\\"Correcto\\"}}\\n}"	\N	2025-08-15 12:33:23.607472+00	2025-08-15 12:33:42.628408+00
0a36307b-48e7-4de1-bea6-58efbe808cce	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-999901", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	\N	\N	2025-08-16 16:00:13.141286+00	2025-08-16 16:00:31.243354+00
d2318ab1-de41-4940-ab6e-da27652ea8a0	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99999", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	{"invoiceRecordId": 19}	\N	2025-08-16 15:47:02.963318+00	2025-08-16 15:47:37.219602+00
ae099311-b6e6-474c-aa8f-753850248c7b	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-99998", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	{"invoiceRecordId": 18}	\N	2025-08-15 12:44:16.565013+00	2025-08-15 12:44:32.011115+00
45bee21e-b31d-44cb-a130-d1c16bd5e797	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F-TEST", "lineas": [{"iva": 21, "desc": "Producto de prueba", "precio": 100}], "numero": "2025-999902", "totales": {"iva": 21, "base": 100, "total": 121}, "receptor": {"nombre": "Cliente de Prueba Final", "idFiscal": "09388720M"}, "emisorNif": "A12345678", "fechaEmision": "2025-08-15"}	{"invoiceRecordId": 21, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-16 16:07:47.444688+00	2025-08-16 16:08:08.51577+00
b7f61044-939c-4cf6-98a0-351093a6c7ce	TENANT_ONBOARDING	COMPLETED	{"nif": "9388721N", "email": "metropol4@hotmail.com", "sector": "Hostelería y Restauración", "modalidad": "VERIFACTU", "razonSocial": "metropol"}	\N	\N	2025-08-19 10:24:14.29954+00	2025-08-19 10:24:23.204148+00
d30fd05e-6a66-4160-9cb6-dfe5c0e74c30	TENANT_ONBOARDING	PROCESSING	{"nif": "09388722", "email": "metropol4@hotmail.com", "sector": "Hostelería y Restauración", "lastName": "Rosal", "password": "123456", "firstName": "mario", "modalidad": "VERIFACTU", "razonSocial": "metropol", "confirmPassword": "123456"}	\N	\N	2025-08-19 12:38:49.723695+00	2025-08-19 12:38:50.215606+00
39a8a5e1-ff13-4a38-9157-18067f9a7ff1	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "E1", "lineas": [{"cantidad": 2, "iva_tipo": 21, "subtotal": 92.4, "descripcion": "[14H0160] ESCALERA FORTES PLUS 4 PELDAÑOS", "iva_importe": 19.4, "precio_unitario": 77}], "numero": "251141", "totales": {"iva": 19.4, "base": 92.4, "total": 111.8}, "receptor": {"nombre": "SUMINISTROS DE FERRETERIA SOLANO S.L.", "idFiscal": "ESB41829045"}, "emisorNif": "09388720m", "fechaEmision": "2025-02-26"}	\N	\N	2025-08-21 14:40:53.112047+00	2025-08-21 14:40:53.227324+00
bfecb0f1-6b3e-458b-bf8f-af4e83404b28	TENANT_ONBOARDING	FAILED	{"nif": "09388722", "email": "metropol4@hotmail.com", "sector": "Hostelería y Restauración", "lastName": "Rosal", "password": "123456", "firstName": "mario", "modalidad": "VERIFACTU", "razonSocial": "metropol", "confirmPassword": "123456"}	\N	\N	2025-08-19 14:17:00.160925+00	2025-08-19 14:17:04.457962+00
c3125b3f-7b03-48e8-8f26-472069961d0e	TENANT_ONBOARDING	FAILED	{"nif": "09388722", "email": "metropol4@hotmail.com", "sector": "Hostelería y Restauración", "lastName": "Rosal", "password": "123456", "firstName": "mario", "modalidad": "VERIFACTU", "razonSocial": "metropol", "confirmPassword": "123456"}	\N	El NIF proporcionado ya se encuentra registrado en el sistema.	2025-08-19 14:25:44.619895+00	2025-08-19 14:25:44.968297+00
ef5ac38d-a973-47e8-833b-77d17878f33e	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "E1", "lineas": [{"cantidad": 2, "iva_tipo": 21, "subtotal": 92.4, "descripcion": "[14H0160] ESCALERA FORTES PLUS 4 PELDAÑOS", "iva_importe": 19.4, "precio_unitario": 77}], "numero": "251141", "totales": {"iva": 19.4, "base": 92.4, "total": 111.8}, "receptor": {"nombre": "SUMINISTROS DE FERRETERIA SOLANO S.L.", "idFiscal": "ESB41829045"}, "emisorNif": "09388720m", "fechaEmision": "2025-02-26"}	\N	\N	2025-08-21 14:52:28.102752+00	2025-08-21 14:52:28.225901+00
7d8b3498-c71a-4049-8f75-2f5d7591fadb	TENANT_ONBOARDING	COMPLETED	{"nif": "09388722", "email": "metropol4@hotmail.com", "sector": "Hostelería y Restauración", "lastName": "Rosal", "password": "123456", "firstName": "mario", "modalidad": "VERIFACTU", "razonSocial": "metropol", "confirmPassword": "123456"}	\N	\N	2025-08-19 14:27:39.472391+00	2025-08-19 14:27:42.83006+00
cac55457-af2e-4433-ba3e-e14ed50137dc	TENANT_ONBOARDING	COMPLETED	{"nif": "09388720m", "email": "mrcompa@gmail.com", "sector": "Hostelería y Restauración", "lastName": "Rosal", "password": "123456", "firstName": "Mario", "modalidad": "VERIFACTU", "razonSocial": "mrcompa", "confirmPassword": "123456"}	\N	\N	2025-08-20 13:41:10.025561+00	2025-08-20 13:41:16.794716+00
d65fe277-40d5-47e2-ae26-70d08fbafae4	INVOICE_SUBMISSION	PENDING	{"tipo": "ALTA", "serie": "E1", "lineas": [{"cantidad": 2, "iva_tipo": 21, "subtotal": 92.4, "descripcion": "[14H0160] ESCALERA FORTES PLUS 4 PELDAÑOS", "iva_importe": 19.4, "precio_unitario": 77}], "numero": "251141", "totales": {"iva": 19.4, "base": 92.4, "total": 111.8}, "receptor": {"nombre": "SUMINISTROS DE FERRETERIA SOLANO S.L.", "idFiscal": "ESB41829045"}, "emisorNif": "09388720m", "fechaEmision": "2025-02-26"}	\N	\N	2025-08-21 13:56:37.683889+00	2025-08-21 13:56:37.683889+00
8883d23d-3f9d-4ee3-a93f-14d7f32b194c	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "E1", "lineas": [{"cantidad": 2, "iva_tipo": 21, "subtotal": 92.4, "descripcion": "[14H0160] ESCALERA FORTES PLUS 4 PELDAÑOS", "iva_importe": 19.4, "precio_unitario": 77}], "numero": "251141", "totales": {"iva": 19.4, "base": 92.4, "total": 111.8}, "receptor": {"nombre": "SUMINISTROS DE FERRETERIA SOLANO S.L.", "idFiscal": "ESB41829045"}, "emisorNif": "09388720m", "fechaEmision": "2025-02-26"}	\N	\N	2025-08-21 14:25:09.469221+00	2025-08-21 14:25:09.734351+00
f74b7336-b463-4ccd-bba9-5649ed75de35	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "E1", "lineas": [{"cantidad": 2, "iva_tipo": 21, "subtotal": 92.4, "descripcion": "[14H0160] ESCALERA FORTES PLUS 4 PELDAÑOS", "iva_importe": 19.4, "precio_unitario": 77}], "numero": "251141", "totales": {"iva": 19.4, "base": 92.4, "total": 111.8}, "receptor": {"nombre": "SUMINISTROS DE FERRETERIA SOLANO S.L.", "idFiscal": "ESB41829045"}, "emisorNif": "09388720m", "fechaEmision": "2025-02-26"}	\N	\N	2025-08-21 14:38:32.663545+00	2025-08-21 14:38:32.812408+00
6d750a25-126a-4c01-9847-c6721d9316f0	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "E1", "lineas": [{"cantidad": 2, "iva_tipo": 21, "subtotal": 92.4, "descripcion": "[14H0160] ESCALERA FORTES PLUS 4 PELDAÑOS", "iva_importe": 19.4, "precio_unitario": 77}], "numero": "251141", "totales": {"iva": 19.4, "base": 92.4, "total": 111.8}, "receptor": {"nombre": "SUMINISTROS DE FERRETERIA SOLANO S.L.", "idFiscal": "ESB41829045"}, "emisorNif": "09388720m", "fechaEmision": "2025-02-26"}	{"invoiceRecordId": 1, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-21 17:19:03.596701+00	2025-08-21 17:19:04.858127+00
311baaa3-3f17-4691-b751-4db95da61f87	TENANT_ONBOARDING	PENDING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-24 21:48:53.272278+00	2025-08-24 21:48:53.272278+00
25c8ac22-31e8-4d02-ac5e-9a5fba93da6b	TENANT_ONBOARDING	PENDING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 08:45:45.486712+00	2025-08-25 08:45:45.486712+00
95844f1a-568d-4b9d-baf3-14d35c04e4f1	TENANT_ONBOARDING	PROCESSING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 08:51:08.526491+00	2025-08-25 08:51:08.684185+00
d24e3734-b4e2-4671-b42a-5ab1558015ed	TENANT_ONBOARDING	PROCESSING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 08:51:58.71325+00	2025-08-25 08:51:58.887445+00
132f86e8-bf7d-4eb7-8a3b-6997ac23f868	TENANT_ONBOARDING	PROCESSING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 08:58:13.578522+00	2025-08-25 08:58:13.718521+00
944012fb-4255-45f0-9401-4d9120e08463	TENANT_ONBOARDING	PROCESSING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 08:59:21.191403+00	2025-08-25 08:59:21.332313+00
70981fd7-4bc1-4f17-a6cc-db21c5afb9e1	TENANT_ONBOARDING	PROCESSING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 09:03:15.811932+00	2025-08-25 09:03:15.937266+00
de0c5ef3-ad1b-4db4-9696-5d0747a88da7	TENANT_ONBOARDING	PROCESSING	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 09:06:47.250917+00	2025-08-25 09:06:47.407103+00
9ffe08cd-3232-4188-bc36-94353e724a5e	TENANT_ONBOARDING	COMPLETED	{"nif": "B71498063", "email": "laura.zamora+obstest-2025-08-25-02@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "Zamora Paredes", "password": "Clave!2025", "firstName": "Laura", "modalidad": "VERIFACTU", "razonSocial": "Cantina La Brújula SL", "confirmPassword": "Clave!2025"}	"{\\"email\\":\\"laura.zamora+obstest-2025-08-25-02@elbuensabor.es\\",\\"firstName\\":\\"Laura\\",\\"lastName\\":\\"Zamora Paredes\\",\\"role\\":\\"ADMIN\\",\\"tenant\\":{\\"id\\":8,\\"nif\\":\\"B71498063\\",\\"razonSocial\\":\\"Cantina La Brújula SL\\",\\"modalidad\\":\\"VERIFACTU\\",\\"certificadosMeta\\":null,\\"email\\":\\"laura.zamora+obstest-2025-08-25-02@elbuensabor.es\\",\\"contactName\\":null,\\"sector\\":\\"Hostelería y Restauración\\",\\"integrationMethod\\":\\"API\\",\\"createdAt\\":\\"2025-08-25T14:02:23.838Z\\"},\\"passwordResetToken\\":null,\\"resetTokenExpires\\":null,\\"id\\":\\"c1679c9f-ea53-481d-bcc2-fd1f2faea5d1\\",\\"isActive\\":true,\\"createdAt\\":\\"2025-08-25T14:02:23.838Z\\",\\"updatedAt\\":\\"2025-08-25T14:02:23.838Z\\"}"	\N	2025-08-25 14:02:19.991291+00	2025-08-25 14:02:25.063174+00
d3c89b42-d516-42d4-997a-f08ae680e19c	TENANT_ONBOARDING	COMPLETED	{"nif": "B12345678 ", "email": "ana.garcia@elbuensabor.es", "sector": "Hostelería y Restauración", "lastName": "García", "password": "password123", "firstName": "Ana", "modalidad": "VERIFACTU", "razonSocial": "El Buen Sabor SL", "confirmPassword": "password123"}	\N	\N	2025-08-25 09:08:31.505886+00	2025-08-25 09:08:34.879605+00
f6ff6ef9-c955-4ab2-85d4-a0c7b6714693	TENANT_ONBOARDING	COMPLETED	{"nif": "B83975143", "email": "mario.salgado+obstest-2025-08-25@elmalsabor.es", "sector": "Comercio Minorista", "lastName": "Salgado", "password": "Sabor!2025", "firstName": "Mario", "modalidad": "VERIFACTU", "razonSocial": "El pesimo sabor. sl", "confirmPassword": "Sabor!2025"}	"{\\"email\\":\\"mario.salgado+obstest-2025-08-25@elmalsabor.es\\",\\"firstName\\":\\"Mario\\",\\"lastName\\":\\"Salgado\\",\\"role\\":\\"ADMIN\\",\\"tenant\\":{\\"id\\":6,\\"nif\\":\\"B83975143\\",\\"razonSocial\\":\\"El Pesimo Sabor. SL\\",\\"modalidad\\":\\"VERIFACTU\\",\\"certificadosMeta\\":null,\\"email\\":\\"mario.salgado+obstest-2025-08-25@elmalsabor.es\\",\\"contactName\\":null,\\"sector\\":\\"Comercio Minorista\\",\\"integrationMethod\\":\\"API\\",\\"createdAt\\":\\"2025-08-25T10:24:09.749Z\\"},\\"passwordResetToken\\":null,\\"resetTokenExpires\\":null,\\"id\\":\\"7b747af0-9769-47d1-90af-219c1a61a2d6\\",\\"isActive\\":true,\\"createdAt\\":\\"2025-08-25T10:24:09.749Z\\",\\"updatedAt\\":\\"2025-08-25T10:24:09.749Z\\"}"	\N	2025-08-25 10:24:06.292559+00	2025-08-25 10:24:10.811222+00
763bfd3b-ffd6-4776-8335-81eb7cf6c665	TENANT_ONBOARDING	COMPLETED	{"nif": "B83975146", "email": "marina.villasenor+obstest-2025-08-25@elmalsabor.es", "sector": "Comercio Minorista", "lastName": "Villaseñor Salgado", "password": "Sabor!2025", "firstName": "Marina", "modalidad": "VERIFACTU", "razonSocial": "El mal sabor. sl", "confirmPassword": "Sabor!2025"}	\N	\N	2025-08-25 09:53:26.26145+00	2025-08-25 09:53:29.512306+00
623d19c6-b699-425b-874a-4ee9fef73108	INVOICE_SUBMISSION	PENDING	{"tipo": "ALTA", "serie": "F5FE54DC-0019", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Dec 15, 2024 - Jan 15, 2025", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-12-15"}	\N	\N	2025-08-25 19:48:31.37661+00	2025-08-25 19:48:31.37661+00
8596e972-9283-4d00-898a-c02dd338a636	TENANT_ONBOARDING	COMPLETED	{"nif": "B83975140", "email": "mariana.pelaez+obstest-2025-08-25@elsabor.es", "sector": "Comercio Minorista", "lastName": "Pelaez", "password": "Sabor!2025", "firstName": "Mariana", "modalidad": "VERIFACTU", "razonSocial": "El sabor. sl", "confirmPassword": "Sabor!2025"}	"{\\"email\\":\\"mariana.pelaez+obstest-2025-08-25@elsabor.es\\",\\"firstName\\":\\"Mariana\\",\\"lastName\\":\\"Pelaez\\",\\"role\\":\\"ADMIN\\",\\"tenant\\":{\\"id\\":7,\\"nif\\":\\"B83975140\\",\\"razonSocial\\":\\"El Sabor SL\\",\\"modalidad\\":\\"VERIFACTU\\",\\"certificadosMeta\\":null,\\"email\\":\\"mariana.pelaez+obstest-2025-08-25@elsabor.es\\",\\"contactName\\":null,\\"sector\\":\\"Comercio Minorista\\",\\"integrationMethod\\":\\"API\\",\\"createdAt\\":\\"2025-08-25T10:42:57.708Z\\"},\\"passwordResetToken\\":null,\\"resetTokenExpires\\":null,\\"id\\":\\"722d126e-5d23-40b2-8e4c-999d0d45cf2d\\",\\"isActive\\":true,\\"createdAt\\":\\"2025-08-25T10:42:57.708Z\\",\\"updatedAt\\":\\"2025-08-25T10:42:57.708Z\\"}"	\N	2025-08-25 10:42:54.755751+00	2025-08-25 10:42:58.411855+00
c84f0700-5c7a-4016-bca4-a32dfc189a3f	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "GCE", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 103.72, "descripcion": "Servicios de hosting y plataforma en la nube (Julio 2025)", "iva_importe": 21.78, "precio_unitario": 103.72}], "numero": "2025", "totales": {"iva": 21.78, "base": 103.72, "total": 125.5}, "receptor": {"nombre": "MyTaskPanel Inc.", "idFiscal": "A1234567Z"}, "emisorNif": "09388720m", "fechaEmision": "2025-07-30"}	{"invoiceRecordId": 43, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-29 12:56:19.42259+00	2025-08-29 12:56:22.108617+00
11d949b9-dc19-456b-a76f-6142d04d8bcf	INVOICE_SUBMISSION	PENDING	{"tipo": "ALTA", "serie": "173925", "lineas": [{"cantidad": 1, "iva_tipo": 0, "subtotal": 0, "descripcion": "Visibility & Opportunity", "iva_importe": 0, "precio_unitario": 0}, {"cantidad": 0, "iva_tipo": 0, "subtotal": 0, "descripcion": "Visibility consumption", "iva_importe": 0, "precio_unitario": 0.01}, {"cantidad": 32500, "iva_tipo": 0, "subtotal": 325, "descripcion": "Opportunity consumption", "iva_importe": 0, "precio_unitario": 0.01}], "totales": {"iva": 0, "base": 325, "total": 325}, "receptor": {"nombre": "Oscar Valente Mytaskpanel Consulting SL", "idFiscal": "ESB40604191"}, "emisorNif": "09388720m", "fechaEmision": "2025-05-22"}	\N	\N	2025-08-25 20:25:22.95029+00	2025-08-25 20:25:22.95029+00
aedfed7e-7f9f-409b-8883-1f456d635d77	INVOICE_SUBMISSION	PENDING	{"tipo": "ALTA", "serie": "F5FE54DC-0018", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Nov 15 - Dec 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-11-15"}	\N	\N	2025-08-25 21:21:53.590092+00	2025-08-25 21:21:53.590092+00
bf8ec58d-786a-4ffa-9d20-13bf1ec77155	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F5FE54DC-0017", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Oct 15 - Nov 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-10-15"}	\N	\N	2025-08-25 21:23:11.301122+00	2025-08-25 21:23:11.609939+00
51d55114-23ac-42fb-a8ec-dd3a1605b01a	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F5FE54DC-0016", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Sep 15 - Oct 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-09-15"}	\N	\N	2025-08-25 21:25:15.607948+00	2025-08-25 21:25:15.838938+00
8f0cfe84-61b9-4092-b30e-988ad7220dc7	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F5FE54DC-0016", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Sep 15 - Oct 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-09-15"}	\N	\N	2025-08-25 21:34:16.854915+00	2025-08-25 21:34:17.033578+00
9d157931-3321-42f1-ba2b-ac8ce58acf74	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "F5FE54DC-0018", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Nov 15 - Dec 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-11-15"}	\N	\N	2025-08-26 09:25:40.215986+00	2025-08-26 09:25:40.502958+00
0e247868-dc60-4f6a-ba30-ef16380de3f9	INVOICE_SUBMISSION	FAILED	{"tipo": "ALTA", "serie": "F5FE54DC-0025", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Jun 15 – Jul 15, 2025", "iva_importe": 4.2, "precio_unitario": 20}], "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2025-06-15"}	\N	Falta numero	2025-08-26 13:41:26.918178+00	2025-08-26 13:41:28.102849+00
9d7ef3bb-c8a1-4916-8133-7188d3a58980	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Jul 15 – Aug 15, 2025", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0026", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2025-07-15"}	{"hashActual": "83C5E1C349A4BD17EC8476C6A8B2211B7FA1544F3A694C0CEBFDDAEE95348896", "invoiceRecordId": 40}	\N	2025-08-26 13:56:48.701929+00	2025-08-26 13:56:49.81731+00
23dd534e-f30a-4d16-b256-817bea9ace1e	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Aug 15 - Sep 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0015", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-08-15"}	{"invoiceRecordId": 41, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-26 13:59:06.17969+00	2025-08-26 13:59:07.553696+00
7b3c32b0-c0b0-4b57-8a89-07e7470ae710	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "", "lineas": [], "numero": "", "totales": {"iva": 0, "base": 0, "total": 0}, "receptor": {"nombre": null, "idFiscal": null}, "emisorNif": "09388720m", "fechaEmision": null}	\N	\N	2025-08-29 08:46:23.84918+00	2025-08-29 08:46:24.121671+00
5a64dc42-246b-4cef-9c8f-386fee983381	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Jul 15 - Aug 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0014", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-07-15"}	{"invoiceRecordId": 42, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-29 08:49:36.978541+00	2025-08-29 08:49:38.552205+00
9e6b3150-383e-44b7-a032-8697c7f80b56	INVOICE_SUBMISSION	FAILED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Jul 15 – Aug 15, 2025", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0026", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2025-07-15"}	\N	duplicate key value violates unique constraint "invoice_record_tenant_id_serie_numero_key"	2025-08-29 19:15:41.665205+00	2025-08-29 19:15:42.638106+00
93fca53a-4586-47fd-a796-f8c3fbb09461	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Sep 15 - Oct 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0016", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-09-15"}	{"hashActual": "FBA299D16C46C09B03C8CB12D5A784A7CDB90998C19D9FFFC83C3426CC17983E", "invoiceRecordId": 47}	\N	2025-08-29 19:06:24.074559+00	2025-08-29 19:06:24.919168+00
ced033c8-91cb-40e9-87f2-4ed815a2cc4e	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Oct 15 - Nov 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0017", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-10-15"}	{"hashActual": "86621313480DCF059E074971C4A0E87644409E6C52624A54E9E9A2288063ED37", "invoiceRecordId": 44, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-29 13:31:51.212966+00	2025-08-29 13:31:52.397242+00
6c4714d5-9569-421b-bd62-95d753a1d568	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription (Dec 15, 2024 - Jan 15, 2025)", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0019", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-12-15"}	{"hashActual": "491B3486E4A6B5EB230CA49CAA0E91EC0B282A4C6A5F1CAD05C67CA5AE2F723A", "invoiceRecordId": 45}	\N	2025-08-29 18:21:26.90158+00	2025-08-29 18:21:28.321887+00
783304b2-efe2-4f82-b5b3-bc52ed0f6f23	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Nov 15 - Dec 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0018", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-11-15"}	{"hashActual": "01B4717B30F0FCEE070F2BACC11C41257B888466400A7D630B421049329A77BC", "invoiceRecordId": 46}	\N	2025-08-29 19:03:38.402982+00	2025-08-29 19:03:39.466516+00
73536a21-2c93-4f63-b94c-999da9cad0e2	INVOICE_SUBMISSION	FAILED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription (Aug 15 - Sep 15, 2024)", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0015", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-08-15"}	\N	duplicate key value violates unique constraint "invoice_record_tenant_id_serie_numero_key"	2025-08-29 19:14:36.543855+00	2025-08-29 19:14:37.608762+00
3e33031e-99b2-4e71-8c6f-40535f6c8fbe	INVOICE_SUBMISSION	PROCESSING	{"tipo": "ALTA", "serie": "008", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 1500, "descripcion": "Servicios de gestión y consultoría CMO", "iva_importe": 315, "precio_unitario": 1500}], "numero": "", "totales": {"iva": 315, "base": 1500, "total": 1590}, "receptor": {"nombre": "CROOWLY S.L.", "idFiscal": "B88329800"}, "emisorNif": "09388720m", "fechaEmision": "2024-07-31"}	\N	\N	2025-08-29 19:17:27.439262+00	2025-08-29 19:17:27.639366+00
6c6fb4d6-5013-487a-a191-156141e5c19f	INVOICE_SUBMISSION	FAILED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0014", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-07-15"}	\N	duplicate key value violates unique constraint "invoice_record_tenant_id_serie_numero_key"	2025-08-29 19:16:14.30462+00	2025-08-29 19:16:17.008143+00
59e15d3f-932a-4422-b923-04d11e3d0110	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Nov 15 - Dec 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0018", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "ESB40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-11-15"}	{"hashActual": "CEC366B6269EF58098BA797CFC998D3F265D91AF1B3AE384BC2B79939121EF6C", "invoiceRecordId": 54, "connectorResponse": {"Respuesta": {"CSV": "CSV_SIMULADO_123456789", "Estado": "Correcto", "Cabecera": {"Titular": {"NIF": "B12345678", "NombreRazon": "ACME SL"}, "IDVersionSii": "1.0"}, "DatosPresentacion": {"NIFPresentador": "B12345678", "TimestampPresentacion": "12-08-2025 16:30:00"}}}}	\N	2025-08-31 08:09:50.238826+00	2025-08-31 08:09:52.530602+00
dcf941d6-4595-41e2-be0a-daaa1132799d	INVOICE_SUBMISSION	FAILED	{"tipo": "ALTA", "serie": "177159", "lineas": [{"cantidad": 1, "iva_tipo": 0, "subtotal": 0, "descripcion": "Visibility & Opportunity", "iva_importe": 0, "precio_unitario": 0}, {"cantidad": 0, "iva_tipo": 0, "subtotal": 0, "descripcion": "Visibility consumption", "iva_importe": 0, "precio_unitario": 0.01}, {"cantidad": 0, "iva_tipo": 0, "subtotal": 0, "descripcion": "Opportunity consumption", "iva_importe": 0, "precio_unitario": 0.01}], "numero": "", "totales": {"iva": 0, "base": 0, "total": 0}, "receptor": {"nombre": "Oscar Valente Mytaskpanel Consulting SL", "idFiscal": "ESB40604191"}, "emisorNif": "09388720m", "fechaEmision": "2025-06-22"}	\N	Falta numero	2025-08-29 19:19:33.19728+00	2025-08-29 19:19:34.312879+00
d6f3228e-1730-4334-a7cb-2f41ba21fa1b	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Sep 15 - Oct 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0016", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-09-15"}	{"hashActual": "210CCEAD98F650C530EF0C02C71022FD264E113ACF44562C8C17E5902440FDA2", "invoiceRecordId": 51}	\N	2025-08-31 07:31:21.993249+00	2025-08-31 07:31:23.128637+00
4fd5197d-af3b-4ca4-92f0-e6f97088c77b	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Oct 15 - Nov 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0017", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-10-15"}	{"hashActual": "264C80C97D37942C0CDC8A37030CC8C8E4D847ADEA8962B75073934DF6455F0B", "invoiceRecordId": 52}	\N	2025-08-31 07:50:41.200278+00	2025-08-31 07:50:42.399973+00
38062169-1b79-4ec8-80a4-9f2e87fa0e3d	INVOICE_SUBMISSION	COMPLETED	{"tipo": "ALTA", "serie": "F5FE54DC", "lineas": [{"cantidad": 1, "iva_tipo": 21, "subtotal": 20, "descripcion": "ChatGPT Plus Subscription Aug 15 - Sep 15, 2024", "iva_importe": 4.2, "precio_unitario": 20}], "numero": "0015", "totales": {"iva": 4.2, "base": 20, "total": 24.2}, "receptor": {"nombre": "Mytaskpanel Consulting SL", "idFiscal": "B40604191"}, "emisorNif": "09388720m", "fechaEmision": "2024-08-15"}	{"hashActual": "29A4D48D6C617417037FFD9B31AEBF100F26B6FD62C757B500BC8E60C48C72FC", "invoiceRecordId": 53}	\N	2025-08-31 08:06:55.091582+00	2025-08-31 08:06:56.149954+00
\.


--
-- TOC entry 3493 (class 0 OID 38939)
-- Dependencies: 217
-- Data for Name: tenant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant (id, nif, razon_social, modalidad, certificados_meta, created_at, integration_method, email, contact_name, sector) FROM stdin;
1	09388720m	Mrcompa	VERIFACTU	\N	2025-08-20 13:41:15.524905+00	API	mrcompa@gmail.com	\N	Hostelería y Restauración
\.


--
-- TOC entry 3501 (class 0 OID 39049)
-- Dependencies: 225
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, first_name, last_name, role, is_active, tenant_id, created_at, updated_at, password_reset_token, reset_token_expires) FROM stdin;
d219e779-b79a-45cd-b410-272690388627	mrcompa@gmail.com	$2a$06$iu/.WhwmZf0wjfn180PIFuiYSMEiR5TpIpXgYFaWt.YisbEC5qVSS	Mario	Rosal	ADMIN	t	1	2025-08-20 13:41:15.524905+00	2025-08-29 07:40:45.191066+00	\N	\N
\.


--
-- TOC entry 3525 (class 0 OID 0)
-- Dependencies: 220
-- Name: dispatch_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.dispatch_id_seq', 1, false);


--
-- TOC entry 3526 (class 0 OID 0)
-- Dependencies: 222
-- Name: event_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.event_log_id_seq', 145, true);


--
-- TOC entry 3527 (class 0 OID 0)
-- Dependencies: 218
-- Name: invoice_record_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoice_record_id_seq', 54, true);


--
-- TOC entry 3528 (class 0 OID 0)
-- Dependencies: 216
-- Name: tenant_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tenant_id_seq', 8, true);


--
-- TOC entry 3337 (class 2606 OID 47245)
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- TOC entry 3339 (class 2606 OID 47243)
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- TOC entry 3324 (class 2606 OID 38979)
-- Name: dispatch dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch
    ADD CONSTRAINT dispatch_pkey PRIMARY KEY (id);


--
-- TOC entry 3326 (class 2606 OID 38994)
-- Name: event_log event_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_log
    ADD CONSTRAINT event_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3320 (class 2606 OID 38962)
-- Name: invoice_record invoice_record_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_record
    ADD CONSTRAINT invoice_record_pkey PRIMARY KEY (id);


--
-- TOC entry 3322 (class 2606 OID 38964)
-- Name: invoice_record invoice_record_tenant_id_serie_numero_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_record
    ADD CONSTRAINT invoice_record_tenant_id_serie_numero_key UNIQUE (tenant_id, serie, numero);


--
-- TOC entry 3328 (class 2606 OID 39027)
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- TOC entry 3314 (class 2606 OID 38950)
-- Name: tenant tenant_nif_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_nif_key UNIQUE (nif);


--
-- TOC entry 3316 (class 2606 OID 38948)
-- Name: tenant tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant
    ADD CONSTRAINT tenant_pkey PRIMARY KEY (id);


--
-- TOC entry 3331 (class 2606 OID 39062)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3333 (class 2606 OID 47235)
-- Name: users users_password_reset_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_password_reset_token_key UNIQUE (password_reset_token);


--
-- TOC entry 3335 (class 2606 OID 39060)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3340 (class 1259 OID 47251)
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_hash ON public.api_keys USING btree (key_hash);


--
-- TOC entry 3317 (class 1259 OID 39000)
-- Name: idx_invoice_record_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_record_estado ON public.invoice_record USING btree (estado_aeat);


--
-- TOC entry 3318 (class 1259 OID 39001)
-- Name: idx_invoice_record_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoice_record_fecha ON public.invoice_record USING btree (fecha_emision);


--
-- TOC entry 3329 (class 1259 OID 39068)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 3347 (class 2620 OID 47314)
-- Name: event_log trg_event_log_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_event_log_append_only BEFORE DELETE OR UPDATE ON public.event_log FOR EACH ROW EXECUTE FUNCTION public.prevent_event_log_modifications();


--
-- TOC entry 3346 (class 2620 OID 47312)
-- Name: invoice_record trg_invoice_record_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_invoice_record_append_only BEFORE DELETE OR UPDATE ON public.invoice_record FOR EACH ROW EXECUTE FUNCTION public.prevent_invoice_record_modifications();


--
-- TOC entry 3348 (class 2620 OID 39029)
-- Name: jobs update_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3349 (class 2620 OID 39069)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 3342 (class 2606 OID 38980)
-- Name: dispatch dispatch_invoice_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispatch
    ADD CONSTRAINT dispatch_invoice_record_id_fkey FOREIGN KEY (invoice_record_id) REFERENCES public.invoice_record(id) ON DELETE CASCADE;


--
-- TOC entry 3343 (class 2606 OID 38995)
-- Name: event_log event_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.event_log
    ADD CONSTRAINT event_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE;


--
-- TOC entry 3344 (class 2606 OID 39063)
-- Name: users fk_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE;


--
-- TOC entry 3345 (class 2606 OID 47246)
-- Name: api_keys fk_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE;


--
-- TOC entry 3341 (class 2606 OID 38965)
-- Name: invoice_record invoice_record_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_record
    ADD CONSTRAINT invoice_record_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE;


-- Completed on 2025-09-05 15:06:36

--
-- PostgreSQL database dump complete
--

