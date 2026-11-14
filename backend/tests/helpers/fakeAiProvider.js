// Testlər üçün saxta AI provayderi: real Gemini heç vaxt çağırılmır.
// script: ardıcıl cavablar. Hər element ya cavab obyektidir ({ text } | { toolCalls }), ya da atılacaq Error.
export const createFakeProvider = (script = []) => {
    const queue = [...script];
    const calls = [];

    return {
        calls,
        async generate(args) {
            calls.push({
                system: args.system,
                messages: JSON.parse(JSON.stringify(args.messages)),
                tools: args.tools,
            });
            if (queue.length === 0) throw new Error('fake AI provider script is exhausted');
            const next = queue.shift();
            if (next instanceof Error) throw next;
            return next;
        },
    };
};
