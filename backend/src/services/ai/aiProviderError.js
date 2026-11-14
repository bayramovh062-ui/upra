// Provayder xətası. kind:
//   busy    - müvəqqəti (429, 5xx, timeout, şəbəkə)
//   config  - açar/model problemi (istifadəçiyə yalnız "mövcud deyil" göstərilir, detal loglanır)
//   blocked - model cavab vermədi (təhlükəsizlik bloku, boş cavab)
export class AiProviderError extends Error {
    constructor(message, kind = 'busy') {
        super(message);
        this.name = 'AiProviderError';
        this.kind = kind;
    }
}
