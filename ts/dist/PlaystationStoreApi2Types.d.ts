export interface Container {
    age_limit?: number;
    attributes?: Record<string, any>;
    container_type?: string;
    content_origin?: number;
    dob_required?: boolean;
    id?: string;
    images?: any[];
    links?: any[];
}
export interface ContainerLoadMatch {
    age_limit: string;
    container_id: string;
    country: string;
    language: string;
    game_content_type?: string;
    genre?: string;
    platform?: string;
    price?: string;
    release_date?: string;
    size?: number;
    sort?: string;
    start?: number;
}
