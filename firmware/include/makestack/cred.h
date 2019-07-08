#ifndef __MAKESTACK_CRED_H__
#define __MAKESTACK_CRED_H__

#include <makestack/types.h>

struct cred {
    uint64_t version;
};

const extern struct cred __cred;

#endif
